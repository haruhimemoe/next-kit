/**
 * @file tests/api-keys/guard.test.ts
 * @desc createApiKeyGuard with a real limiter on the in-memory MongoDB and a stub store: missing
 *       and bad keys count per IP, good keys count per user (writes twice), every answer carries
 *       RateLimit headers and no-store, thrown handlers become JSON 500s.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { API_LIMITS, createApiKeyGuard } from "../../src/api-keys/guard.js";
import { createRateLimiter } from "../../src/server/index.js";
import { testDatabase } from "../helpers/db.js";

const { connectedDb } = testDatabase("api-guard");
const GOOD = `hpl_${"A".repeat(43)}`;
const NOW = Date.parse("2026-10-03T12:00:10.000Z");
const limiter = createRateLimiter({ db: connectedDb, now: () => NOW });
const stamp = vi.fn(async () => {});
const authenticate = vi.fn(async (key: string) => (key === GOOD ? { userId: "u1", stamp } : null));
const withApiKey = createApiKeyGuard({
  store: { authenticate },
  limiter,
  now: () => NOW,
  resolveCaller: async (id) => (id === "u1" ? { id, name: "cookiezi" } : null),
  messages: { missing: "Send a key.", invalid: "Bad key." },
});
const ok = withApiKey(async (_request, caller) => Response.json({ name: caller.name }));
const call = (handler: typeof ok, init: { key?: string; method?: string; ip?: string } = {}) =>
  handler(
    new Request("https://pools.haruhime.moe/api/v1/me", {
      method: init.method ?? "GET",
      headers: {
        ...(init.key ? { authorization: `Bearer ${init.key}` } : {}),
        "x-forwarded-for": init.ip ?? "203.0.113.9",
      },
    }),
    undefined,
  );

describe("createApiKeyGuard", () => {
  it("passes a good key through with headers", async () => {
    const response = await call(ok, { key: GOOD });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "cookiezi" });
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    expect(response.headers.get("RateLimit-Remaining")).toBe("59");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(stamp).toHaveBeenCalled();
  });

  it("401s a missing key with WWW-Authenticate", async () => {
    const response = await call(ok);
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Send a key." },
    });
  });

  it("401s another app's key as invalid_api_key", async () => {
    const response = await call(ok, { key: `hpk_${"A".repeat(43)}` });
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("invalid_api_key");
  });

  it("401s a key whose user is gone", async () => {
    stamp.mockClear();
    authenticate.mockResolvedValueOnce({ userId: "deleted-user", stamp });
    expect((await call(ok, { key: GOOD })).status).toBe(401);
    expect(stamp).not.toHaveBeenCalled();
  });

  it("429s an IP past the failure limit, but not a good key from it", async () => {
    for (let i = 0; i < API_LIMITS.authFail.limit; i++) await call(ok, { key: "bad" });
    const refused = await call(ok, { key: "bad" });
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).not.toBeNull();
    expect((await call(ok, { key: GOOD })).status).toBe(200);
  });

  it("counts writes against both counters and shows the tighter one", async () => {
    const response = await call(ok, { key: GOOD, method: "POST" });
    expect(response.headers.get("RateLimit-Limit")).toBe("10");
    expect(response.headers.get("RateLimit-Remaining")).toBe("9");
  });

  it("429s past the write limit", async () => {
    for (let i = 0; i < API_LIMITS.apiWrite.limit; i++) {
      await call(ok, { key: GOOD, method: "DELETE" });
    }
    expect((await call(ok, { key: GOOD, method: "DELETE" })).status).toBe(429);
    expect((await call(ok, { key: GOOD })).status).toBe(200);
  });

  it("turns a thrown handler into a JSON 500 with headers", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = withApiKey(async () => {
      throw new Error("boom");
    });
    const response = await call(boom, { key: GOOD });
    expect(response.status).toBe(500);
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    expect((await response.json()).error.code).toBe("internal_error");
    quiet.mockRestore();
  });

  it("500s when the key lookup throws, without counting anything", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    authenticate.mockRejectedValueOnce(new Error("db down"));
    const response = await call(ok, { key: GOOD });
    expect(response.status).toBe(500);
    expect(response.headers.get("RateLimit-Remaining")).toBe("60");
    quiet.mockRestore();
  });

  it("still answers when the limiter's database is down (fails open)", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = createApiKeyGuard({
      store: { authenticate },
      limiter: createRateLimiter({ db: () => Promise.reject(new Error("down")) }),
      resolveCaller: async (id) => ({ id }),
      messages: { missing: "m", invalid: "i" },
    });
    const response = await call(
      down(async () => Response.json({})),
      { key: GOOD },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    quiet.mockRestore();
  });
});
