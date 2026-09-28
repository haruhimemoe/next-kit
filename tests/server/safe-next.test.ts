/**
 * @file tests/server/safe-next.test.ts
 * @desc safeNextPath and signInHref: pools' cases (tests/unit/utils/safe-next.test.ts), which
 *       include packs', with the fallback and sign-in page as options.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SIGN_IN_PATH, safeNextPath, signInHref } from "../../src/server/index.js";

const options = { fallback: "/account" };

describe("safeNextPath", () => {
  it.each(["/new", "/p/abcdefghij/edit", "/me?tab=packs", "/signing", "/signinfo"])(
    "keeps %j",
    (path) => {
      expect(safeNextPath(path, options)).toBe(path);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "new",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/ok\\..\\evil",
    "/\n//evil.example",
    "/a\u007fb",
    `/${"a".repeat(600)}`,
    "/signin",
    "/signin?next=%2Fsignin",
    "/signin/",
    "/signin#top",
  ])("replaces %j with the fallback", (raw) => {
    expect(safeNextPath(raw, options)).toBe("/account");
  });

  it("takes the caller's fallback and sign-in page", () => {
    expect(safeNextPath("//x", { fallback: "/me" })).toBe("/me");
    const login = { fallback: "/me", signInPath: "/log.in" };
    expect(safeNextPath("/log.in?next=/", login)).toBe("/me");
    expect(safeNextPath("/logXin", login)).toBe("/logXin");
    expect(safeNextPath("/signin", login)).toBe("/signin");
  });
});

describe("signInHref", () => {
  it("encodes the destination", () => {
    expect(DEFAULT_SIGN_IN_PATH).toBe("/signin");
    expect(signInHref("/p/abc?x=1")).toBe("/signin?next=%2Fp%2Fabc%3Fx%3D1");
    expect(signInHref("/me", "/login")).toBe("/login?next=%2Fme");
  });
});
