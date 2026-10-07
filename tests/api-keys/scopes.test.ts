/**
 * @file tests/api-keys/scopes.test.ts
 * @desc hasScope and normalizeScopes: "*" matches all, a missing field reads ["*"], dedupe, and
 *       empty, malformed or undeclared names refused.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { ALL_SCOPES, hasScope, normalizeScopes, storedScopes } from "../../src/api-keys/scopes.js";

describe("hasScope", () => {
  it("matches a granted scope and * matches all", () => {
    expect(hasScope(["read"], "read")).toBe(true);
    expect(hasScope(["read"], "write")).toBe(false);
    expect(hasScope([ALL_SCOPES], "write")).toBe(true);
    expect(hasScope([], "read")).toBe(false);
  });
});

describe("normalizeScopes", () => {
  it("reads a missing field as *", () => {
    expect(normalizeScopes(undefined)).toEqual(["*"]);
    expect(normalizeScopes(null)).toEqual(["*"]);
  });

  it("dedupes in order", () => {
    expect(normalizeScopes(["read", "write", "read"])).toEqual(["read", "write"]);
  });

  it("refuses empty, malformed and undeclared names", () => {
    expect(() => normalizeScopes([])).toThrow(TypeError);
    expect(() => normalizeScopes(["Bad Name"])).toThrow(TypeError);
    expect(() => normalizeScopes(["admin"], ["read", "write"])).toThrow(TypeError);
    expect(normalizeScopes(["*", "read"], ["read"])).toEqual(["*", "read"]);
  });
});

describe("storedScopes", () => {
  it("reads missing as * and a bad field as nothing, without throwing", () => {
    expect(storedScopes(undefined)).toEqual([ALL_SCOPES]);
    expect(storedScopes([])).toEqual([]);
    expect(storedScopes("*")).toEqual([]);
    expect(storedScopes(["read", 3])).toEqual(["read"]);
  });
});
