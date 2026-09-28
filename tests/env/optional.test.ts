/**
 * @file tests/env/optional.test.ts
 * @desc The per-call readers: pools' getAdminOsuIds, PACKS_URL and POOLS_ALLOW_SHARED_DB_USER
 *       cases and packs' CRON_SECRET and POOLS_SERVICE_TOKEN cases (tests/unit/env.test.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  invalidEnv,
  optionalSecret,
  readFlag,
  readIdSet,
  readOptional,
  readOrigin,
} from "../../src/env/index.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readOptional", () => {
  it("trims, and reads blank as unset", () => {
    expect(readOptional("X", { X: "  a " })).toBe("a");
    expect(readOptional("X", { X: "   " })).toBeUndefined();
    expect(readOptional("X", {})).toBeUndefined();
  });
});

describe("optionalSecret (CRON_SECRET 16+, POOLS_SERVICE_TOKEN 32+)", () => {
  it("reads the secret on every call, trimmed, undefined when unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(optionalSecret("CRON_SECRET", 16)).toBeUndefined();
    vi.stubEnv("CRON_SECRET", "  cron-secret-0123456789\n");
    expect(optionalSecret("CRON_SECRET", 16)).toBe("cron-secret-0123456789");
    vi.stubEnv("CRON_SECRET", "another-cron-secret-99");
    expect(optionalSecret("CRON_SECRET", 16)).toBe("another-cron-secret-99");
  });

  it("takes exactly the minimum and throws below it, naming but never printing it", () => {
    const token = "a".repeat(31);
    expect(optionalSecret("POOLS_SERVICE_TOKEN", 32, { POOLS_SERVICE_TOKEN: `${token}a` })).toBe(
      `${token}a`,
    );
    expect(() => optionalSecret("POOLS_SERVICE_TOKEN", 32, { POOLS_SERVICE_TOKEN: token })).toThrow(
      invalidEnv(["POOLS_SERVICE_TOKEN"]),
    );
  });
});

describe("readIdSet (ADMIN_OSU_IDS)", () => {
  it("is empty when unset or blank", () => {
    vi.stubEnv("ADMIN_OSU_IDS", "");
    expect(readIdSet("ADMIN_OSU_IDS").size).toBe(0);
    vi.stubEnv("ADMIN_OSU_IDS", "   ");
    expect(readIdSet("ADMIN_OSU_IDS").size).toBe(0);
  });

  it("reads ids separated by commas and spaces, fresh on every call", () => {
    vi.stubEnv("ADMIN_OSU_IDS", "12231334, 2");
    expect([...readIdSet("ADMIN_OSU_IDS")]).toEqual([12231334, 2]);
    vi.stubEnv("ADMIN_OSU_IDS", "7");
    expect([...readIdSet("ADMIN_OSU_IDS")]).toEqual([7]);
  });

  it.each(["abc", "1,,2", "1;2", "12231334,"])("refuses %j without printing it", (value) => {
    vi.stubEnv("ADMIN_OSU_IDS", value);
    expect(() => readIdSet("ADMIN_OSU_IDS")).toThrow(invalidEnv(["ADMIN_OSU_IDS"]));
  });
});

describe("readFlag (POOLS_ALLOW_SHARED_DB_USER)", () => {
  const KEY = "POOLS_ALLOW_SHARED_DB_USER";

  it("is on for true (around spaces), read fresh on every call", () => {
    vi.stubEnv(KEY, undefined);
    expect(readFlag(KEY)).toBe(false);
    vi.stubEnv(KEY, " true\n");
    expect(readFlag(KEY)).toBe(true);
    vi.stubEnv(KEY, "");
    expect(readFlag(KEY)).toBe(false);
  });

  it.each(["TRUE", "True", "1", "yes", "on", "false", "truee"])("is off for %j", (value) => {
    expect(readFlag(KEY, { [KEY]: value })).toBe(false);
  });
});

describe("readOrigin (PACKS_URL)", () => {
  const FALLBACK = "https://packs.haruhime.moe";
  const read = (value?: string) => readOrigin("PACKS_URL", FALLBACK, { PACKS_URL: value });

  it("falls back when unset", () => {
    expect(read()).toBe(FALLBACK);
    expect(read(" ")).toBe(FALLBACK);
  });

  it("takes an https origin, or plain http on localhost", () => {
    expect(read("https://packs.example.com/")).toBe("https://packs.example.com");
    expect(read("http://localhost:3001")).toBe("http://localhost:3001");
    expect(read("http://127.0.0.1:3001")).toBe("http://127.0.0.1:3001");
  });

  it.each([
    "http://packs.example.com",
    "ftp://packs.example.com",
    "not a url",
    "https://x.dev/api",
    "https://x.dev/?a=1",
    "https://x.dev/#a",
  ])("refuses %j", (value) => {
    expect(() => read(value)).toThrow(invalidEnv(["PACKS_URL"]));
  });
});
