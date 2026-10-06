/**
 * @file src/legal/index.ts
 * @desc @haruhimemoe/next-kit/legal: the five-page legal convention (terms, privacy,
 *       your-privacy-rights, copyright, disclaimers). `LegalSite` config, seven MDX blocks
 *       rendered from it, `legalEntries` for the app's content registry, and
 *       `legalMarkdownTransform` for the .md mirrors and llms-full.txt.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

export {
  Changes,
  type ChangesProps,
  DataWeKeep,
  DmcaNotice,
  type LegalBlockProps,
  LegalContact,
  NoWarranty,
  Processors,
  YourRights,
} from "./blocks.js";
export { type LegalPageOverrides, legalEntries } from "./entries.js";
export { legalMarkdownTransform } from "./markdown.js";
export {
  LEGAL_SLUGS,
  type LegalDataStore,
  type LegalProcessor,
  type LegalSite,
  type LegalSlug,
} from "./types.js";
