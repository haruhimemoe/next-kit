/**
 * @file src/legal/types.ts
 * @desc LegalSite: the per-app config the legal blocks and legalEntries render from. No site
 *       name, URL, email or data list is hardcoded here; every app passes its own.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

/** A third party that processes data on the app's behalf, like Vercel or MongoDB Atlas. */
export type LegalProcessor = {
  name: string;
  purpose: string;
  link?: string;
};

/** One kind of data the app stores, and why. */
export type LegalDataStore = {
  what: string;
  why: string;
};

/** The five standard legal page slugs every service ships, in the order they're listed. */
export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "your-privacy-rights",
  "copyright",
  "disclaimers",
] as const;

/** One of `LEGAL_SLUGS`. */
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** The config every legal block and `legalEntries` renders from. */
export type LegalSite = {
  /** The site's display name, like "packs.haruhime.moe". */
  siteName: string;
  /** Who runs the site, for the contact and "who's responsible" lines. */
  operator: string;
  /** Where a legal request, question or notice goes. */
  contactEmail: string;
  /** YYYY-MM-DD. Shown as this page's "last updated" date by `Changes`. */
  effectiveDate: string;
  /** What the app keeps, in `DataWeKeep`'s order. */
  stores: readonly LegalDataStore[];
  /** Who processes data on the app's behalf, in `Processors`'s order. */
  processors: readonly LegalProcessor[];
  /** The cookies the app sets, one line each, in `DataWeKeep`'s cookie list. */
  cookies: readonly string[];
};
