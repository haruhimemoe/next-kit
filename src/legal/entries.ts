/**
 * @file src/legal/entries.ts
 * @desc legalEntries: the five standard `ContentEntry` records (`docs`'s registry shape) for the
 *       five-page legal convention, so apps stop hand-writing the same titles and descriptions.
 *       An app overrides any field per slug through `pages`; unlisted fields keep the default.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { ContentEntry } from "../docs/registry.js";
import { LEGAL_SLUGS, type LegalSite, type LegalSlug } from "./types.js";

/** The default title and description for each of the five legal slugs. */
const DEFAULTS: Record<LegalSlug, { title: string; description: string }> = {
  terms: { title: "Terms of Service", description: "The rules for using {site}." },
  privacy: { title: "Privacy Policy", description: "What {site} stores and why." },
  "your-privacy-rights": {
    title: "GDPR & CCPA",
    description: "Your rights over your data under the GDPR and the CCPA, and how to use them.",
  },
  copyright: {
    title: "Copyright & Takedown",
    description: "How to report a copyright concern, and where to send a DMCA notice.",
  },
  disclaimers: {
    title: "Disclaimers",
    description: "Who {site} isn't affiliated with, and what it doesn't promise.",
  },
};

/** Per-slug overrides for any `ContentEntry` field, keyed by `LegalSlug`. */
export type LegalPageOverrides = Partial<Record<LegalSlug, Partial<ContentEntry>>>;

/**
 * @function legalEntries
 * @param site {LegalSite} the site config; `siteName` fills the default descriptions
 * @param pages {LegalPageOverrides} [pages] per-slug overrides (a different description, a
 *   `navTitle`, a page-specific `lastUpdated`); omitted fields keep the default
 * @returns {ContentEntry[]} the five entries, in `LEGAL_SLUGS` order, ready for the `legal` array
 *   an app's content registry (`defineContent`) takes
 */
export const legalEntries = (site: LegalSite, pages?: LegalPageOverrides): ContentEntry[] =>
  LEGAL_SLUGS.map((slug) => {
    const fallback = DEFAULTS[slug];
    return {
      slug,
      title: fallback.title,
      description: fallback.description.replace("{site}", site.siteName),
      lastUpdated: site.effectiveDate,
      ...pages?.[slug],
    };
  });
