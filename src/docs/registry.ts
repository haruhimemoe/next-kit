/**
 * @file src/docs/registry.ts
 * @desc The content registry a site builds its docs, guides and legal pages
 *       from: a frozen list of sections, the entry shape each page fills in, the app-made extra
 *       entries a section's nav and search also carry (like bb's tag pages), and the validation
 *       that catches a bad slug, a duplicate, a made-up date or a blank title at build time
 *       instead of at a 404. Pure: no node: imports, so it runs anywhere.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sat Oct 10, 2026
 */

/** A slug is lowercase words separated by single hyphens, like "make-a-pack". */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A date is YYYY-MM-DD and a real calendar day. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The content sections a site can have, in the order they're shown. */
export const CONTENT_SECTIONS = ["docs", "guides", "legal"] as const;

/** One of `CONTENT_SECTIONS`. */
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

/** The nav label for each section. */
export const SECTION_LABELS: Record<ContentSection, string> = {
  docs: "Docs",
  guides: "Guides",
  legal: "Legal",
};

/** One numbered step of a HowTo entry. */
export type HowToStep = { name: string; text: string };

/** A page backed by a markdown file: its slug, nav copy and when it last changed. */
export type ContentEntry = {
  slug: string;
  title: string;
  navTitle?: string;
  description: string;
  /** YYYY-MM-DD. */
  lastUpdated: string;
  howTo?: readonly HowToStep[];
};

/** An app-made page shown in a section's nav and search, e.g. bb's tag pages. */
export type ExtraEntry = {
  href: string;
  title: string;
  navTitle?: string;
  description: string;
  group: string;
  badge?: string;
  lastUpdated?: string;
  markdownHref?: string;
};

/** What an app passes to `defineContent`: its entries and extras, by section. */
export type ContentInput = Partial<Record<ContentSection, readonly ContentEntry[]>> & {
  extra?: Partial<Record<ContentSection, readonly ExtraEntry[]>>;
};

/** A validated, section-complete content registry. */
export type Content = {
  /** Non-empty sections, in `CONTENT_SECTIONS` order. */
  sections: ContentSection[];
  entries: Record<ContentSection, readonly ContentEntry[]>;
  extra: Record<ContentSection, readonly ExtraEntry[]>;
};

const assertEntries = (section: ContentSection, entries: readonly ContentEntry[]): void => {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!SLUG_PATTERN.test(entry.slug))
      throw new Error(`docs: bad slug "${entry.slug}" in ${section}`);
    if (seen.has(entry.slug)) throw new Error(`docs: duplicate slug "${entry.slug}" in ${section}`);
    seen.add(entry.slug);
    if (!DATE_PATTERN.test(entry.lastUpdated) || Number.isNaN(Date.parse(entry.lastUpdated)))
      throw new Error(`docs: bad lastUpdated "${entry.lastUpdated}" in ${section} "${entry.slug}"`);
    if (!entry.title.trim()) throw new Error(`docs: blank title in ${section} "${entry.slug}"`);
  }
};

const assertExtras = (section: ContentSection, extras: readonly ExtraEntry[]): void => {
  const seen = new Set<string>();
  for (const extra of extras) {
    if (!extra.href.startsWith("/"))
      throw new Error(`docs: extra href "${extra.href}" must start with "/" in ${section}`);
    if (seen.has(extra.href))
      throw new Error(`docs: duplicate extra href "${extra.href}" in ${section}`);
    seen.add(extra.href);
    if (!extra.title.trim())
      throw new Error(`docs: blank title for extra "${extra.href}" in ${section}`);
  }
};

/**
 * @function defineContent
 * @param input {ContentInput} each section's entries, and the app-made extras under `extra`
 * @returns {Content} every section filled in (empty arrays for the ones left out), and
 *   `sections` listing only the non-empty ones, in `CONTENT_SECTIONS` order
 * @throws {Error} naming the section and slug or extra href, for a bad slug, a duplicate slug,
 *   a duplicate extra href, a `lastUpdated` that isn't a real `YYYY-MM-DD` date, or a blank title
 */
export const defineContent = (input: ContentInput): Content => {
  const entries = {} as Record<ContentSection, readonly ContentEntry[]>;
  const extra = {} as Record<ContentSection, readonly ExtraEntry[]>;
  const sections: ContentSection[] = [];
  for (const section of CONTENT_SECTIONS) {
    const sectionEntries = input[section] ?? [];
    const sectionExtras = input.extra?.[section] ?? [];
    assertEntries(section, sectionEntries);
    assertExtras(section, sectionExtras);
    entries[section] = sectionEntries;
    extra[section] = sectionExtras;
    if (sectionEntries.length > 0 || sectionExtras.length > 0) sections.push(section);
  }
  return { sections, entries, extra };
};

/**
 * @function contentPath
 * @param section {ContentSection} the section the page lives under
 * @param slug {string} the entry's slug
 * @returns {string} the page's path, like "/guides/make-a-pack"
 */
export const contentPath = (section: ContentSection, slug: string): string => `/${section}/${slug}`;

/**
 * @function markdownPath
 * @param section {ContentSection} the section the page lives under
 * @param slug {string} the entry's slug
 * @returns {string} the page's raw markdown path, like "/guides/make-a-pack.md"
 */
export const markdownPath = (section: ContentSection, slug: string): string =>
  `${contentPath(section, slug)}.md`;

/**
 * @function findEntry
 * @param content {Content} a registry from `defineContent`
 * @param section {ContentSection} the section to search
 * @param slug {string} the entry's slug
 * @returns {ContentEntry | undefined} the matching entry, or undefined
 */
export const findEntry = (
  content: Content,
  section: ContentSection,
  slug: string,
): ContentEntry | undefined => content.entries[section].find((entry) => entry.slug === slug);

/**
 * @function contentParams
 * @param content {Content} a registry from `defineContent`
 * @param section {ContentSection} the section to list
 * @returns {{ slug: string }[]} one param per entry, for a dynamic route's `generateStaticParams`
 */
export const contentParams = (content: Content, section: ContentSection): { slug: string }[] =>
  content.entries[section].map((entry) => ({ slug: entry.slug }));
