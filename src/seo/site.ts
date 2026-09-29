/**
 * @file src/seo/site.ts
 * @desc The site description every seo helper reads (`Site`), the haruhime.moe organization the
 *       four sites share, the "Primary keyword · host" title rule, and the small URL, date and
 *       @id helpers the metadata, sitemap and JSON-LD builders share.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** One Open Graph image. A relative `url` resolves against the site's origin. */
export type OgImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
};

/** The organization behind a site: schema.org Organization, and every page's publisher. */
export type Organization = {
  name: string;
  /** Its home page, like https://www.haruhime.moe. Its @id is `${url}/#organization`. */
  url: string;
  logo?: string;
  email?: string;
  /** Profiles that are the same entity: GitHub org, Discord invite, npm org. */
  sameAs?: readonly string[];
};

/** One site: what siteMetadata, pageMetadata, robots, sitemapEntries and the ld builders read. */
export type Site = {
  /** The product name, like "pools". og:site_name, applicationName, the WebSite name. */
  name: string;
  /** The canonical origin, like https://pools.haruhime.moe (www for haruhime.moe). */
  url: string;
  /** The home page's primary keyword, like "osu! tournament mappool builder". */
  title: string;
  /** What follows " · " in every title. Defaults to the host, like pools.haruhime.moe. */
  titleSuffix?: string;
  /** The default description, 140 to 160 characters. */
  description: string;
  /** Open Graph locale. Defaults to en_US. */
  locale?: string;
  /** Twitter handles, with the @. */
  twitter?: { site?: string; creator?: string };
  /** The default preview image(s). Every page keeps them unless it passes its own. */
  ogImages: readonly OgImage[];
  organization: Organization;
  /** The parent site of a tool (www.haruhime.moe): the WebSite's isPartOf. */
  parent?: { name: string; url: string };
};

/** The haruhime.moe organization the four sites share (A6: one entity, one @id). */
export const HARUHIME_ORG: Organization = {
  name: "haruhime.moe",
  url: "https://www.haruhime.moe",
  logo: "https://www.haruhime.moe/apple-icon.png",
  email: "contact@haruhime.moe",
  sameAs: [
    "https://github.com/haruhimemoe",
    "https://discord.gg/bKy9kjMV4y",
    "https://www.npmjs.com/org/haruhimemoe",
  ],
};

/** The separator between a page's keyword and the site in every title. */
export const TITLE_SEPARATOR = " · ";

/**
 * @function origin
 * @param url {string} a site or organization URL
 * @returns {string} its origin, no trailing slash
 * @throws {TypeError} when url isn't an absolute URL
 */
export const origin = (url: string): string => new URL(url).origin;

/**
 * @function absoluteUrl
 * @param site {Pick<Site, "url">} the site
 * @param path {string} a path starting with "/", or an absolute URL on the site's origin
 * @returns {string} the absolute URL on the site's canonical origin
 * @throws {Error} when path is relative or on another origin
 */
export const absoluteUrl = (site: Pick<Site, "url">, path: string): string => {
  const base = origin(site.url);
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) {
    const url = new URL(path);
    if (url.origin !== base) throw new Error(`seo: ${path} is not on ${base}`);
    return url.href;
  }
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`seo: path "${path}" must start with one "/"`);
  }
  return `${base}${path}`;
};

/**
 * @function nodeId
 * @param url {string} a site or organization URL
 * @param name {string} the fragment, like "organization", "website" or "app"
 * @returns {string} a stable JSON-LD @id, like https://www.haruhime.moe/#organization
 */
export const nodeId = (url: string, name: string): string => `${origin(url)}/#${name}`;

/**
 * @function titleSuffix
 * @param site {Site} the site
 * @returns {string} what follows " · " in its titles: titleSuffix, or the host
 */
export const titleSuffix = (site: Site): string => site.titleSuffix ?? new URL(site.url).host;

/**
 * @function pageTitle
 * @param site {Site} the site
 * @param title {string} the page's primary keyword, like "Search osu! tournament mappools"
 * @returns {string} "Primary keyword · host" (the suffix is added once, never twice)
 * @throws {Error} when title is blank
 */
export const pageTitle = (site: Site, title: string): string => {
  const keyword = title.replace(/\s+/g, " ").trim();
  if (!keyword) throw new Error("seo: a page title can't be blank");
  const suffix = `${TITLE_SEPARATOR}${titleSuffix(site)}`;
  return keyword.endsWith(suffix) ? keyword : `${keyword}${suffix}`;
};

/**
 * @function isoDate
 * @param value {string | Date | null | undefined} a date, maybe unknown
 * @returns {string | undefined} ISO 8601, or undefined when missing or not a real date (never
 *          a made-up one)
 */
export const isoDate = (value: string | Date | null | undefined): string | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

/**
 * @function compact
 * @param object {T} an object that may hold undefined values
 * @returns {T} the same keys minus the undefined ones (so exactOptionalPropertyTypes holds)
 */
export const compact = <T extends Record<string, unknown>>(object: T): T =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as T;
