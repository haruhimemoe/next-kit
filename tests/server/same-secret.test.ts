/**
 * @file tests/server/same-secret.test.ts
 * @desc sameSecret and bearerToken: packs' cases (tests/unit/lib/machine-auth.test.ts), with
 *       node:crypto's timingSafeEqual spied on.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const { timingSafeEqual } = vi.hoisted(() => ({ timingSafeEqual: vi.fn() }));
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  timingSafeEqual.mockImplementation(real.timingSafeEqual);
  return { ...real, timingSafeEqual };
});

const { bearerToken, sameSecret } = await import("../../src/server/index.js");

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest();

describe("sameSecret", () => {
  it("is true only for the same secret", () => {
    const secret = "a-token-of-32-characters-0123456";
    expect(sameSecret(secret, secret)).toBe(true);
    expect(sameSecret("a-token-of-32-characters-0123457", secret)).toBe(false);
  });

  it("never throws on secrets of different lengths", () => {
    expect(sameSecret("", "x".repeat(64))).toBe(false);
    expect(sameSecret("x".repeat(500), "x")).toBe(false);
  });

  it("compares the two SHA-256 digests with timingSafeEqual", () => {
    timingSafeEqual.mockClear();
    sameSecret("given", "secret");
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
    expect(timingSafeEqual).toHaveBeenCalledWith(sha256("given"), sha256("secret"));
  });
});

describe("bearerToken", () => {
  const headers = (authorization?: string) =>
    new Headers(authorization === undefined ? {} : { authorization });

  it("reads what follows Bearer", () => {
    expect(bearerToken(headers("Bearer abc"))).toBe("abc");
  });

  it.each([undefined, "", "Bearer ", "Basic abc", "abc", "bearer abc"])(
    "is null for %j",
    (value) => {
      expect(bearerToken(headers(value))).toBeNull();
    },
  );
});
