/**
 * @file tests/seo/hreflang.test.ts
 * @desc hreflangAlternates matches the "as-needed" prefix, and pageMetadata writes the languages
 *       next to the canonical.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { expect, it } from "vitest";
import { hreflangAlternates, pageMetadata } from "../../src/seo/index.js";
import { POOLS } from "./fixture.js";

const config = { locales: ["en", "ja"], defaultLocale: "en" };

it("prefixes every locale but the default, and adds x-default", () => {
  expect(hreflangAlternates(config, "/search", "https://www.haruhime.moe/")).toEqual({
    en: "https://www.haruhime.moe/search",
    ja: "https://www.haruhime.moe/ja/search",
    "x-default": "https://www.haruhime.moe/search",
  });
  expect(hreflangAlternates(config, "/", "https://www.haruhime.moe")).toEqual({
    en: "https://www.haruhime.moe/",
    ja: "https://www.haruhime.moe/ja",
    "x-default": "https://www.haruhime.moe/",
  });
});

it("refuses a relative or protocol-relative path", () => {
  expect(() => hreflangAlternates(config, "search", "https://x.test")).toThrow(/must start/);
  expect(() => hreflangAlternates(config, "//evil", "https://x.test")).toThrow(/must start/);
});

it("pageMetadata passes languages through beside the canonical", () => {
  const languages = hreflangAlternates(config, "/search", POOLS.url);
  const meta = pageMetadata(POOLS, { path: "/search", title: "Search", alternates: { languages } });
  expect(meta.alternates).toEqual({
    canonical: `${POOLS.url.replace(/\/$/, "")}/search`,
    languages,
  });
  expect(pageMetadata(POOLS, { path: "/", title: "x" }).alternates).toEqual({
    canonical: expect.any(String),
  });
});
