/**
 * @file src/seo/metadata.ts
 * @desc Next.js Metadata for the root layout, the home page, every other page and not-found.
 *       A page's openGraph replaces the layout's whole object in Next (it isn't merged), so
 *       pageMetadata always rebuilds it in full: site name, locale, type, url and images (audit T2),
 *       with the canonical and og:url set together from one path (T1, T3).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Metadata } from "next";
import { clampDescription } from "./describe.js";
import {
  absoluteUrl,
  compact,
  isoDate,
  type OgImage,
  pageTitle,
  type Site,
  TITLE_SEPARATOR,
  titleSuffix,
} from "./site.js";

/** pageMetadata's input. */
export type PageMetadataOptions = {
  /** The page's path, like "/search". Canonical and og:url both come from it. */
  path: string;
  /** The primary keyword; " · host" is added (pageTitle). */
  title: string;
  /** Defaults to the site's description. Clamped to 160 characters. */
  description?: string;
  /** false: noindex, follow. Default true. */
  index?: boolean;
  /** Default "website". "article" also writes the published and modified times. */
  ogType?: "website" | "article";
  /** Defaults to the site's ogImages, so a page never loses its preview. */
  images?: readonly OgImage[];
  modifiedTime?: string | Date;
  publishedTime?: string | Date;
};

const DEFAULT_LOCALE = "en_US";

const twitter = (site: Site, extra: Metadata["twitter"] = {}): Metadata["twitter"] =>
  compact({
    card: "summary_large_image" as const,
    site: site.twitter?.site,
    creator: site.twitter?.creator,
    ...extra,
  });

/**
 * @function siteMetadata
 * @param site {Site} the site
 * @returns {Metadata} the root layout's metadata: metadataBase, the title default and template,
 *          description, applicationName, openGraph (type, site name, locale, images) and the
 *          twitter card. No canonical: a layout canonical would leak to every child page.
 *          Icons stay with the app (its icon files).
 */
export const siteMetadata = (site: Site): Metadata => {
  return {
    metadataBase: new URL(site.url),
    title: {
      default: pageTitle(site, site.title),
      template: `%s${TITLE_SEPARATOR}${titleSuffix(site)}`,
    },
    description: clampDescription(site.description),
    applicationName: site.name,
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: site.locale ?? DEFAULT_LOCALE,
      images: [...site.ogImages],
    },
    twitter: twitter(site, { images: site.ogImages.map((image) => image.url) }),
  };
};

/**
 * @function pageMetadata
 * @param site {Site} the site
 * @param options {PageMetadataOptions} the page
 * @returns {Metadata} an absolute "keyword · host" title, the clamped description, the
 *          canonical and og:url (always together, as absolute URLs), a full openGraph and
 *          twitter card, and robots noindex when index is false
 * @throws {Error} when path doesn't start with "/" or the title is blank
 */
export const pageMetadata = (site: Site, options: PageMetadataOptions): Metadata => {
  const url = absoluteUrl(site, options.path);
  const title = pageTitle(site, options.title);
  const description = clampDescription(options.description ?? site.description);
  const images = [...(options.images ?? site.ogImages)];
  const base = {
    title,
    description,
    url,
    siteName: site.name,
    locale: site.locale ?? DEFAULT_LOCALE,
    images,
  };
  const openGraph: Metadata["openGraph"] =
    options.ogType === "article"
      ? compact({
          ...base,
          type: "article" as const,
          publishedTime: isoDate(options.publishedTime),
          modifiedTime: isoDate(options.modifiedTime),
        })
      : { ...base, type: "website" };
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph,
    twitter: twitter(site, { title, description, images: images.map((image) => image.url) }),
    ...(options.index === false ? { robots: { index: false, follow: true } } : {}),
  };
};

/**
 * @function homeMetadata
 * @param site {Site} the site
 * @param options {{ title?: string; description?: string }} overrides for the site's own
 * @returns {Metadata} pageMetadata for "/": "keyword · host", canonical and og:url on the origin
 */
export const homeMetadata = (
  site: Site,
  options: { title?: string; description?: string } = {},
): Metadata =>
  pageMetadata(site, {
    path: "/",
    title: options.title ?? site.title,
    ...(options.description === undefined ? {} : { description: options.description }),
  });

/**
 * @function notFoundMetadata
 * @param site {Site} the site
 * @param what {string} what's missing, like "Pack" (default "Page")
 * @returns {Metadata} "Pack not found · host", noindex, and no canonical (audit T8: missing
 *          records returned {} and got the site's default title)
 */
export const notFoundMetadata = (site: Site, what = "Page"): Metadata => ({
  title: { absolute: pageTitle(site, `${what} not found`) },
  robots: { index: false, follow: false },
});
