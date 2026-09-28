/**
 * @file tests/server/machine-auth.test.ts
 * @desc refuseWithoutBearer against the in-memory MongoDB: packs' pools-token cases
 *       (tests/integration/lib/machine-auth.test.ts: 503 while unset, 401, failures counted per
 *       IP up to a 429, the right token never refused) and its cron case (no counting).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optionalSecret } from "../../src/env/index.js";
import { createRateLimiter, refuseWithoutBearer } from "../../src/server/index.js";
import { testDatabase } from "../helpers/db.js";

const { connectedDb } = testDatabase("machine-auth");

const TOKEN = "pools-service-token-for-tests-0123456789";
const FAIL_RULE = { scope: "service-auth-fail", limit: 10, windowSeconds: 60 };
const limiter = createRateLimiter({
  db: connectedDb,
  now: () => Date.parse("2026-09-24T12:00:30Z"),
});
const pools = {
  secret: () => optionalSecret("POOLS_SERVICE_TOKEN", 32),
  label: "pools",
  notConfigured: "The pools service isn't set up on this server.",
  failures: { limiter, rule: FAIL_RULE },
  noStore: true,
};

const call = (authorization?: string, ip = "198.51.100.4") =>
  refuseWithoutBearer(
    new Request("http://localhost:3000/api/service/pools/stats", {
      method: "POST",
      headers: { ...(authorization === undefined ? {} : { authorization }), "x-real-ip": ip },
    }),
    pools,
  );

const codeOf = async (response: Response | null): Promise<string | null> =>
  response ? ((await response.json()) as { error: { code: string } }).error.code : null;

describe("refuseWithoutBearer with counted failures (the pools token)", () => {
  beforeEach(() => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", TOKEN);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets the right token through", async () => {
    expect(await call(`Bearer ${TOKEN}`)).toBeNull();
  });

  it("takes a token pasted with spaces or a trailing newline", async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", `  ${TOKEN}\n`);
    expect(await call(`Bearer ${TOKEN}`)).toBeNull();
  });

  it("takes a token of exactly 32 characters and refuses one of 31 as not set up", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("POOLS_SERVICE_TOKEN", "a".repeat(32));
    expect(await call(`Bearer ${"a".repeat(32)}`)).toBeNull();
    vi.stubEnv("POOLS_SERVICE_TOKEN", "a".repeat(31));
    const response = await call(`Bearer ${"a".repeat(31)}`);
    expect(response?.status).toBe(503);
    expect(await codeOf(response)).toBe("not_configured");
    quiet.mockRestore();
  });

  it("refuses everything while the token isn't set, whatever is sent", async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    for (const authorization of [undefined, "Bearer ", `Bearer ${TOKEN}`]) {
      const response = await call(authorization);
      expect(response?.status).toBe(503);
      expect(response?.headers.get("cache-control")).toBe("no-store");
      expect(await response?.json()).toEqual({
        error: {
          code: "not_configured",
          message: "The pools service isn't set up on this server.",
        },
      });
    }
  });

  it("names a short token in the log but never prints it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("POOLS_SERVICE_TOKEN", "short-but-secret");
    await call("Bearer short-but-secret");
    const logged = error.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("[pools]");
    expect(logged).toContain("POOLS_SERVICE_TOKEN");
    expect(logged).not.toContain("short-but-secret");
    error.mockRestore();
  });

  it("rethrows an error that isn't an EnvError", async () => {
    const broken = {
      ...pools,
      secret: () => {
        throw new TypeError("bug");
      },
    };
    await expect(refuseWithoutBearer(new Request("http://x/"), broken)).rejects.toThrow("bug");
  });

  it.each([
    ["no header", undefined],
    ["a wrong token", "Bearer not-the-pools-token-at-all-000000000"],
    ["the token without Bearer", TOKEN],
    ["a longer token", `Bearer ${TOKEN}x`],
    ["an empty token", "Bearer "],
  ])("answers 401 to %s, never cached", async (_label, authorization) => {
    const response = await call(authorization);
    expect(response?.status).toBe(401);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(await codeOf(response)).toBe("unauthorized");
  });

  it(`answers 429 after ${FAIL_RULE.limit} failures a minute from one IP`, async () => {
    for (let i = 0; i < FAIL_RULE.limit; i++) {
      expect((await call("Bearer wrong"))?.status).toBe(401);
    }
    const limited = await call("Bearer wrong");
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(limited?.headers.get("cache-control")).toBe("no-store");
    expect(await codeOf(limited)).toBe("rate_limited");
    // Another IP still gets its own tries, and the right token is never counted or refused.
    expect((await call("Bearer wrong", "198.51.100.5"))?.status).toBe(401);
    expect(await call(`Bearer ${TOKEN}`)).toBeNull();
  });
});

describe("refuseWithoutBearer without counting (the cron secret)", () => {
  const cron = (secret: string | undefined) => ({
    secret: () => secret,
    label: "cron",
    notConfigured: "The stats job isn't set up.",
  });
  const request = (authorization: string) =>
    new Request("http://localhost/api/cron/pack-stats", { headers: { authorization } });

  it("lets the secret through and refuses anything else with a cacheable 401", async () => {
    expect(
      await refuseWithoutBearer(
        request("Bearer cron-secret-01234567"),
        cron("cron-secret-01234567"),
      ),
    ).toBeNull();
    const refused = await refuseWithoutBearer(request("Bearer nope"), cron("cron-secret-01234567"));
    expect(refused?.status).toBe(401);
    expect(refused?.headers.get("cache-control")).toBeNull();
    const unset = await refuseWithoutBearer(request("Bearer x"), cron(undefined));
    expect(unset?.status).toBe(503);
    expect(await codeOf(unset)).toBe("not_configured");
  });
});
