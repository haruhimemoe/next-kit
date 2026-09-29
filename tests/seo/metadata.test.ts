/**
 * @file tests/seo/metadata.test.ts
 * @desc siteMetadata, homeMetadata, pageMetadata and notFoundMetadata: the canonical and og:url
 *       always travel together, a page's openGraph always carries the images, site name, locale
 *       and type (audit T2), titles follow "keyword · host", and noindex is explicit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  homeMetadata,
  notFoundMetadata,
  pageMetadata,
  pageTitle,
  siteMetadata,
} from "../../src/seo/index.js";
import { POOLS, WWW } from "./fixture.js";

const og = (value: unknown) => value as Record<string, unknown>;

describe("siteMetadata", () => {
  it("sets the root layout's base, titles, openGraph and twitter, and no canonical", () => {
    const meta = siteMetadata(POOLS);
    expect(String(meta.metadataBase)).toBe("https://pools.haruhime.moe/");
    expect(meta.title).toEqual({
      default: "osu! tournament mappool builder · pools.haruhime.moe",
      template: "%s · pools.haruhime.moe",
    });
    expect(meta.applicationName).toBe("pools");
    expect(meta.openGraph).toEqual({
      type: "website",
      siteName: "pools",
      locale: "en_US",
      images: POOLS.ogImages,
    });
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      site: "@haruhimemoe",
      creator: "@dvhsh",
      images: ["/opengraph-image.png"],
    });
    expect(meta.alternates).toBeUndefined();
    expect(meta.icons).toBeUndefined();
  });

  it("uses the suffix and locale the site sets, and clamps a long default description", () => {
    const meta = siteMetadata({ ...WWW, description: "word ".repeat(60) });
    expect(meta.title).toEqual({
      default: "osu! tools for players, mappers and tournament hosts · haruhime.moe",
      template: "%s · haruhime.moe",
    });
    expect(og(meta.openGraph).locale).toBe("en_GB");
    expect(meta.twitter).toEqual({ card: "summary_large_image", images: [] });
    expect((meta.description ?? "").length).toBeLessThanOrEqual(160);
  });
});

describe("pageMetadata", () => {
  const meta = pageMetadata(POOLS, {
    path: "/search",
    title: "Search osu! tournament mappools and maps",
    description: "Search every past osu! tournament mappool.",
  });

  it("sets the canonical and og:url together, as the same absolute URL", () => {
    expect(meta.alternates?.canonical).toBe("https://pools.haruhime.moe/search");
    expect(og(meta.openGraph).url).toBe(meta.alternates?.canonical);
  });

  it("keeps the images, site name, locale and type in the page's openGraph", () => {
    expect(meta.openGraph).toEqual({
      type: "website",
      title: "Search osu! tournament mappools and maps · pools.haruhime.moe",
      description: "Search every past osu! tournament mappool.",
      url: "https://pools.haruhime.moe/search",
      siteName: "pools",
      locale: "en_US",
      images: POOLS.ogImages,
    });
    expect(og(meta.twitter).images).toEqual(["/opengraph-image.png"]);
  });

  it("writes an absolute keyword · host title and leaves robots alone when indexed", () => {
    expect(meta.title).toEqual({
      absolute: "Search osu! tournament mappools and maps · pools.haruhime.moe",
    });
    expect(meta.robots).toBeUndefined();
  });

  it("falls back to the site's description, clamped", () => {
    const page = pageMetadata(
      { ...POOLS, description: `${"long ".repeat(50)}end` },
      {
        path: "/check",
        title: "Check",
      },
    );
    expect(page.description?.endsWith("…")).toBe(true);
    expect(og(page.openGraph).description).toBe(page.description);
  });

  it("marks a page noindex, follow and still pairs its canonical and og:url", () => {
    const page = pageMetadata(POOLS, { path: "/maps/1", title: "A map", index: false });
    expect(page.robots).toEqual({ index: false, follow: true });
    expect(og(page.openGraph).url).toBe("https://pools.haruhime.moe/maps/1");
    expect(page.alternates?.canonical).toBe("https://pools.haruhime.moe/maps/1");
  });

  it("uses the page's own images when given", () => {
    const images = [{ url: "/p/x/opengraph-image" }];
    const page = pageMetadata(POOLS, { path: "/p/x", title: "Pack", images });
    expect(og(page.openGraph).images).toEqual(images);
    expect(og(page.twitter).images).toEqual(["/p/x/opengraph-image"]);
  });

  it("writes article times as ISO and drops unknown ones", () => {
    const page = pageMetadata(POOLS, {
      path: "/guide/a",
      title: "Guide",
      ogType: "article",
      modifiedTime: new Date("2026-09-01T00:00:00Z"),
      publishedTime: "not a date",
    });
    expect(og(page.openGraph).type).toBe("article");
    expect(og(page.openGraph).modifiedTime).toBe("2026-09-01T00:00:00.000Z");
    expect(og(page.openGraph)).not.toHaveProperty("publishedTime");
  });

  it("refuses a relative path, another origin, or a blank title", () => {
    expect(() => pageMetadata(POOLS, { path: "search", title: "x" })).toThrow(/must start/);
    expect(() => pageMetadata(POOLS, { path: "//evil.example/x", title: "x" })).toThrow();
    expect(() => pageMetadata(POOLS, { path: "https://evil.example/", title: "x" })).toThrow(
      /not on/,
    );
    expect(() => pageMetadata(POOLS, { path: "/", title: "  " })).toThrow(/blank/);
  });

  it("accepts an absolute URL on the site's own origin", () => {
    const page = pageMetadata(POOLS, { path: "https://pools.haruhime.moe/data", title: "Data" });
    expect(page.alternates?.canonical).toBe("https://pools.haruhime.moe/data");
  });
});

describe("homeMetadata", () => {
  it("is the home page with the site's keyword title", () => {
    const meta = homeMetadata(POOLS);
    expect(meta.title).toEqual({
      absolute: "osu! tournament mappool builder · pools.haruhime.moe",
    });
    expect(meta.alternates?.canonical).toBe("https://pools.haruhime.moe/");
    expect(og(meta.openGraph).url).toBe("https://pools.haruhime.moe/");
    expect(meta.description).toBe(POOLS.description);
  });

  it("takes a title and description override", () => {
    const meta = homeMetadata(WWW, { title: "osu! tools", description: "Tools." });
    expect(meta.title).toEqual({ absolute: "osu! tools · haruhime.moe" });
    expect(meta.description).toBe("Tools.");
  });
});

describe("notFoundMetadata", () => {
  it("names what's missing, noindex, with no canonical", () => {
    expect(notFoundMetadata(POOLS, "Pool")).toEqual({
      title: { absolute: "Pool not found · pools.haruhime.moe" },
      robots: { index: false, follow: false },
    });
    expect(notFoundMetadata(WWW).title).toEqual({ absolute: "Page not found · haruhime.moe" });
  });
});

describe("pageTitle", () => {
  it("adds the suffix once and collapses whitespace", () => {
    expect(pageTitle(POOLS, "  Search\n maps ")).toBe("Search maps · pools.haruhime.moe");
    expect(pageTitle(POOLS, "Search · pools.haruhime.moe")).toBe("Search · pools.haruhime.moe");
  });
});
