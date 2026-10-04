/**
 * @file tests/api-keys/format.test.ts
 * @desc The key format: prefix rule, generation, SHA-256 hash, display prefix, format check and
 *       the Bearer parser. Ported from packs (tests/unit/lib/api-key.test.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { describe, expect, it } from "vitest";
import {
  API_KEY_DISPLAY_LENGTH,
  apiKeyDisplay,
  apiKeyToken,
  assertApiKeyPrefix,
  generateApiKey,
  hashApiKey,
  isApiKeyFormat,
} from "../../src/api-keys/format.js";

const headers = (authorization?: string) =>
  new Headers(authorization === undefined ? {} : { authorization });

describe("assertApiKeyPrefix", () => {
  it.each(["hpk_", "hpl_", "hbb_"])("accepts %s", (prefix) => {
    expect(() => assertApiKeyPrefix(prefix)).not.toThrow();
  });
  it.each(["", "hpk", "pk1.", "HPK_", "hp_", "hpkk_", "xpk_"])("rejects %j", (prefix) => {
    expect(() => assertApiKeyPrefix(prefix)).toThrow(TypeError);
  });
});

describe("generateApiKey", () => {
  it("is the prefix plus 32 random bytes in base64url", () => {
    const key = generateApiKey("hpl_");
    expect(key).toMatch(/^hpl_[A-Za-z0-9_-]{43}$/);
    expect(isApiKeyFormat("hpl_", key)).toBe(true);
  });
  it("never repeats", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey("hpk_")));
    expect(keys.size).toBe(200);
  });
  it("refuses a bad prefix", () => {
    expect(() => generateApiKey("nope")).toThrow(TypeError);
  });
});

describe("hashApiKey", () => {
  it("is SHA-256 hex (same digest packs stores)", () => {
    expect(hashApiKey("hpk_test")).toBe(
      "98104252b18a60d97de9105ed1d51cfe544d634edea9d4e0f3b9985c71e6d370",
    );
  });
});

describe("apiKeyDisplay", () => {
  it("keeps the first 12 characters", () => {
    const key = `hpk_${"AbCdEfGh".repeat(5)}xyz`;
    expect(apiKeyDisplay(key)).toBe("hpk_AbCdEfGh");
    expect(apiKeyDisplay(key)).toHaveLength(API_KEY_DISPLAY_LENGTH);
  });
});

describe("isApiKeyFormat", () => {
  it.each([
    ["", false],
    ["hpk_", false],
    [`hpk_${"A".repeat(42)}`, false],
    [`hpk_${"A".repeat(44)}`, false],
    [`hpk_${"A".repeat(42)}=`, false],
    [`hpl_${"A".repeat(43)}`, false],
    [`hpk_${"A".repeat(43)}`, true],
    [`hpk_${"-_".repeat(21)}A`, true],
  ])("%j is %s for hpk_", (value, ok) => {
    expect(isApiKeyFormat("hpk_", value)).toBe(ok);
  });
});

describe("apiKeyToken", () => {
  it.each([
    [undefined, null],
    ["", null],
    ["Bearer", null],
    ["Bearer ", null],
    ["Basic abc", null],
    ["Bearer a b", null],
    ["Bearer abc", "abc"],
    ["bearer abc", "abc"],
    ["BEARER \t abc  ", "abc"],
  ])("%j gives %j", (authorization, token) => {
    expect(apiKeyToken(headers(authorization))).toBe(token);
  });
});
