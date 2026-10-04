/**
 * @file src/docs/crawl.ts
 * @desc /llms.txt, /llms-full.txt, sitemap entries and the ".md" mirror rewrite, built straight
 *       from a content registry. Pure: no node: imports or file reads here (an app's
 *       `read`/`readContentMarkdown` provides the Markdown), so it runs anywhere `docs` does.
 *       Reuses `llmsTxt`/`llmsFull` from `../seo/llms.js` for formatting, so escaping and section
 *       shape stay the same as every other haruhime.moe crawl file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import {
  type LlmsFullPart,
  type LlmsLink,
  type LlmsSection,
  llmsFull,
  llmsTxt,
} from "../seo/llms.js";
import { absoluteUrl, type Site } from "../seo/site.js";
import type { SitemapRecord } from "../seo/sitemap.js";
import {
  type Content,
  type ContentSection,
  contentPath,
  markdownPath,
  SECTION_LABELS,
} from "./registry.js";

/** The "API" section's links: a title, an already-absolute URL and an optional note. */
export type ContentApiLink = { title: string; url: string; note?: string };

/** contentLlmsTxt's options. */
export type ContentLlmsTxtOptions = {
  site: Site;
  title: string;
  summary: string;
  notes?: readonly string[];
  content: Content;
  /** The "API" section's links, like the OpenAPI document or `/api/v1/me`. */
  api?: readonly ContentApiLink[];
};

const sectionLinks = (site: Site, content: Content, section: ContentSection): LlmsLink[] => [
  ...content.entries[section].map((entry) => ({
    title: entry.title,
    url: absoluteUrl(site, markdownPath(section, entry.slug)),
    note: entry.description,
  })),
  ...content.extra[section].map((extra) => ({
    title: extra.title,
    url: absoluteUrl(site, extra.markdownHref ?? extra.href),
    note: extra.description,
  })),
];

/**
 * @function contentLlmsTxt
 * @param options {ContentLlmsTxtOptions} the site, the file's head, the registry and the API
 *   section's links
 * @returns {string} the llms.txt body, sections in order Docs, Guides, API, Legal; an empty
 *   section (no entries, no extras, no `api` links) is left out
 */
export const contentLlmsTxt = (options: ContentLlmsTxtOptions): string => {
  const { site, title, summary, notes, content, api = [] } = options;
  const sections: LlmsSection[] = [
    { heading: SECTION_LABELS.docs, links: sectionLinks(site, content, "docs") },
    { heading: SECTION_LABELS.guides, links: sectionLinks(site, content, "guides") },
    {
      heading: "API",
      links: api.map(({ title: t, url, note }) => ({ title: t, url, ...(note ? { note } : {}) })),
    },
    { heading: SECTION_LABELS.legal, links: sectionLinks(site, content, "legal") },
  ];
  return llmsTxt({ title, summary, ...(notes ? { notes } : {}), sections });
};

/** contentLlmsFull's options. */
export type ContentLlmsFullOptions = {
  site: Site;
  title: string;
  summary?: string;
  content: Content;
  /** Reads one entry's Markdown, usually `readContentMarkdown` from `docs/files`. */
  read: (section: ContentSection, slug: string) => Promise<string>;
  /** Parts written before the registry's entries, like a brief introduction. */
  before?: readonly LlmsFullPart[];
  /** Parts written after the registry's entries, like extras an app reads on its own. */
  after?: readonly LlmsFullPart[];
};

/** A leading "# ...\n" line, and the one blank line after it, if any. */
const LEADING_HEADING = /^# [^\n]*\n\n?/;

const stripLeadingHeading = (markdown: string): string => markdown.replace(LEADING_HEADING, "");

/**
 * @function contentLlmsFull
 * @param options {ContentLlmsFullOptions} the site, the file's head, the registry, a reader and
 *   extra parts to place before and after the registry's entries
 * @returns {Promise<string>} the llms-full.txt body: `before`, then every registry entry in
 *   section order (title, its absolute page URL, and `read`'s Markdown with its own leading H1
 *   stripped, since `llmsFull` writes the part title as the H1), then `after`
 */
export const contentLlmsFull = async (options: ContentLlmsFullOptions): Promise<string> => {
  const { site, title, summary, content, read, before = [], after = [] } = options;
  const parts: LlmsFullPart[] = [...before];
  for (const section of content.sections) {
    for (const entry of content.entries[section]) {
      const markdown = await read(section, entry.slug);
      parts.push({
        title: entry.title,
        url: absoluteUrl(site, contentPath(section, entry.slug)),
        markdown: stripLeadingHeading(markdown),
      });
    }
  }
  parts.push(...after);
  return llmsFull(parts, { title, ...(summary ? { summary } : {}) });
};

const newestDate = (dates: readonly string[]): string | undefined =>
  dates.length ? dates.reduce((newest, date) => (date > newest ? date : newest)) : undefined;

/**
 * @function contentSitemap
 * @param content {Content} a registry from `defineContent`
 * @returns {SitemapRecord[]} one record per non-empty section: the section's index path (like
 *   "/docs") with `lastModified` set to the newest `lastUpdated` among its entries and extras
 *   (omitted when none have one), then each entry with its own `lastUpdated`, then each extra
 *   with its own `lastUpdated` when set
 */
export const contentSitemap = (content: Content): SitemapRecord[] => {
  const records: SitemapRecord[] = [];
  for (const section of content.sections) {
    const entries = content.entries[section];
    const extras = content.extra[section];
    const newest = newestDate([
      ...entries.map((entry) => entry.lastUpdated),
      ...extras.flatMap((extra) => (extra.lastUpdated ? [extra.lastUpdated] : [])),
    ]);
    records.push({ path: `/${section}`, ...(newest ? { lastModified: newest } : {}) });
    for (const entry of entries) {
      records.push({ path: contentPath(section, entry.slug), lastModified: entry.lastUpdated });
    }
    for (const extra of extras) {
      records.push({
        path: extra.href,
        ...(extra.lastUpdated ? { lastModified: extra.lastUpdated } : {}),
      });
    }
  }
  return records;
};

/** One Next.js rewrite rule: `source` and `destination`. */
export type ContentRewriteRule = { source: string; destination: string };

/**
 * @function contentRewrites
 * @returns {ContentRewriteRule[]} the one rule that mirrors a content page's ".md" URL
 *   (`/docs/x.md`, `/guides/x.md`, `/legal/x.md`) to its route handler (`/docs/x/md`, ...)
 */
export const contentRewrites = (): ContentRewriteRule[] => [
  {
    source: "/:section(docs|guides|legal)/:slug([a-z0-9-]+).md",
    destination: "/:section/:slug/md",
  },
];
