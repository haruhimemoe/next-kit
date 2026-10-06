/**
 * @file tests/server/safe-next.test.ts
 * @desc safeNextPath and signInHref: pools' cases (tests/unit/utils/safe-next.test.ts), which
 *       include packs', with the fallback and sign-in page as options. 0.12: safeAbsoluteNext,
 *       the hub's allowlist for a satellite's full-URL `next`, with the open-redirect test list
 *       from the identity spec (section 2).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIGN_IN_PATH,
  safeAbsoluteNext,
  safeNextPath,
  signInHref,
} from "../../src/server/index.js";

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

describe("safeAbsoluteNext", () => {
  const hosts = ["haruhime.moe", "pools.haruhime.moe"];
  const fallback = "https://haruhime.moe/account";

  it.each([
    "https://haruhime.moe/signin",
    "https://haruhime.moe/p/abc?x=1",
    "https://pools.haruhime.moe/",
  ])("keeps %j", (raw) => {
    expect(safeAbsoluteNext(raw, { hosts, fallback })).toBe(raw);
  });

  it("matches the hostname case-insensitively", () => {
    expect(safeAbsoluteNext("https://HARUHIME.MOE/", { hosts, fallback })).toBe(
      "https://HARUHIME.MOE/",
    );
    expect(safeAbsoluteNext("https://haruhime.moe/", { hosts: ["HARUHIME.MOE"], fallback })).toBe(
      "https://haruhime.moe/",
    );
  });

  it.each([
    [null, "no value"],
    [undefined, "no value"],
    ["", "empty"],
    ["https://evil.com", "an unlisted host"],
    ["https://haruhime.moe.evil.com", "a suffix match, not an exact one"],
    ["https://evilharuhime.moe", "a prefix match, not an exact one"],
    ["//evil.com", "protocol-relative, not an absolute URL"],
    ["https://haruhime.moe@evil.com/", "userinfo that masks the real host"],
    ["http://haruhime.moe", "http, not https"],
    ["HARUHIME.MOE", "no scheme at all"],
    ["https://new.haruhime.moe/", "an unlisted subdomain"],
    [`https://haruhime.moe/${"a".repeat(600)}`, "longer than MAX_NEXT_LENGTH"],
  ])("replaces %j (%s) with the fallback", (raw: string | null | undefined, _why: string) => {
    expect(safeAbsoluteNext(raw, { hosts, fallback })).toBe(fallback);
  });
});

describe("signInHref", () => {
  it("encodes the destination", () => {
    expect(DEFAULT_SIGN_IN_PATH).toBe("/signin");
    expect(signInHref("/p/abc?x=1")).toBe("/signin?next=%2Fp%2Fabc%3Fx%3D1");
    expect(signInHref("/me", "/login")).toBe("/login?next=%2Fme");
  });
});
