/**
 * @file tests/seo/sitemap.test.ts
 * @desc sitemapEntries: absolute URLs on the canonical origin, first entry wins on a duplicate,
 *       lastModified only when real, priority range, and the 50,000-URL cap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { SITEMAP_MAX_URLS, sitemapEntries } from "../../src/seo/index.js";
import { POOLS, WWW } from "./fixture.js";

describe("sitemapEntries", () => {
  it("builds absolute URLs from static paths and records, in order", () => {
    const out = sitemapEntries(POOLS, [
      ["/", "/search"],
      [
        {
          path: "/pools/otdb-98",
          lastModified: "2026-09-01T12:00:00Z",
          changeFrequency: "monthly",
          priority: 0.8,
        },
      ],
    ]);
    expect(out).toEqual([
      { url: "https://pools.haruhime.moe/" },
      { url: "https://pools.haruhime.moe/search" },
      {
        url: "https://pools.haruhime.moe/pools/otdb-98",
        lastModified: "2026-09-01T12:00:00.000Z",
        changeFrequency: "monthly",
        priority: 0.8,
      },
    ]);
  });

  it("uses the canonical origin even when the site URL has a trailing slash", () => {
    expect(sitemapEntries(WWW, [["/brand"]])).toEqual([{ url: "https://www.haruhime.moe/brand" }]);
  });

  it("omits lastModified when it's missing, null, empty or not a date", () => {
    const out = sitemapEntries(POOLS, [
      [
        { path: "/a" },
        { path: "/b", lastModified: null },
        { path: "/c", lastModified: "" },
        { path: "/d", lastModified: "yesterday-ish" },
        { path: "/e", lastModified: new Date(Number.NaN) },
        { path: "/f", lastModified: new Date("2026-01-02T00:00:00Z") },
      ],
    ]);
    expect(out.map((entry) => "lastModified" in entry)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(out[5]?.lastModified).toBe("2026-01-02T00:00:00.000Z");
  });

  it("keeps the first entry for a URL listed twice", () => {
    const out = sitemapEntries(POOLS, [
      ["/", "/search"],
      [{ path: "/search", priority: 1 }, "https://pools.haruhime.moe/"],
    ]);
    expect(out).toEqual([
      { url: "https://pools.haruhime.moe/" },
      { url: "https://pools.haruhime.moe/search" },
    ]);
  });

  it("refuses paths off the site and priorities outside 0 to 1", () => {
    expect(() => sitemapEntries(POOLS, [["https://packs.haruhime.moe/"]])).toThrow(/not on/);
    expect(() => sitemapEntries(POOLS, [["pools"]])).toThrow(/must start/);
    expect(() => sitemapEntries(POOLS, [[{ path: "/", priority: 1.5 }]])).toThrow(RangeError);
    expect(() => sitemapEntries(POOLS, [[{ path: "/", priority: Number.NaN }]])).toThrow(
      RangeError,
    );
  });

  it("allows exactly 50,000 URLs and throws past that", () => {
    const paths = Array.from({ length: SITEMAP_MAX_URLS }, (_, i) => `/maps/${i}`);
    expect(sitemapEntries(POOLS, [paths])).toHaveLength(SITEMAP_MAX_URLS);
    expect(() => sitemapEntries(POOLS, [paths, ["/one-more"]])).toThrow(
      /50001 sitemap URLs, over the 50000.*generateSitemaps/,
    );
  });
});
