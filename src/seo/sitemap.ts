/**
 * @file src/seo/sitemap.ts
 * @desc sitemap.xml entries from static paths and records: absolute URLs on the canonical origin,
 *       one entry per URL, and lastModified only when it's known and real (audit T4: an import
 *       time or a made-up date teaches crawlers to ignore lastmod). Throws past 50,000 URLs, the
 *       sitemaps.org cap for one file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { MetadataRoute } from "next";
import { absoluteUrl, compact, isoDate, type Site } from "./site.js";

/** The most URLs one sitemap file may list (sitemaps.org). */
export const SITEMAP_MAX_URLS = 50_000;

/** How often a page changes, as sitemaps.org spells it. */
export type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

/** One page: its path and what's known about it. */
export type SitemapRecord = {
  /** A path like "/pools/otdb-98", or an absolute URL on the site's origin. */
  path: string;
  /** When its content last changed. Missing or invalid: no lastmod (never a guess). */
  lastModified?: string | Date | null;
  changeFrequency?: ChangeFrequency;
  /** 0 to 1. */
  priority?: number;
};

/** One group: plain paths, records, or both. */
export type SitemapGroup = readonly (string | SitemapRecord)[];

const toEntry = (site: Site, item: string | SitemapRecord): MetadataRoute.Sitemap[number] => {
  const record = typeof item === "string" ? { path: item } : item;
  const { priority } = record;
  if (priority !== undefined && !(priority >= 0 && priority <= 1)) {
    throw new RangeError(`seo: sitemap priority for ${record.path} must be 0 to 1`);
  }
  return compact({
    url: absoluteUrl(site, record.path),
    lastModified: isoDate(record.lastModified),
    changeFrequency: record.changeFrequency,
    priority,
  });
};

/**
 * @function sitemapEntries
 * @param site {Site} the site
 * @param groups {readonly SitemapGroup[]} static paths and dynamic records, in the order they
 *        should appear
 * @returns {MetadataRoute.Sitemap} one entry per URL (the first one wins), absolute URLs, and no
 *          lastModified where it's unknown
 * @throws {Error} when a path isn't on the site, a priority is outside 0 to 1, or there are
 *         more than 50,000 URLs (split into sitemap files with generateSitemaps)
 */
export const sitemapEntries = (
  site: Site,
  groups: readonly SitemapGroup[],
): MetadataRoute.Sitemap => {
  const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const group of groups) {
    for (const item of group) {
      const entry = toEntry(site, item);
      if (!byUrl.has(entry.url)) byUrl.set(entry.url, entry);
    }
  }
  if (byUrl.size > SITEMAP_MAX_URLS) {
    throw new Error(
      `seo: ${byUrl.size} sitemap URLs, over the ${SITEMAP_MAX_URLS} a sitemap file may list. Split it with generateSitemaps.`,
    );
  }
  return [...byUrl.values()];
};
