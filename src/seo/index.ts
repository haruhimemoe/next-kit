/**
 * @file src/seo/index.ts
 * @desc @haruhimemoe/next-kit/seo: metadata for the root layout and every page (canonical and
 *       og:url together, openGraph never dropped), robots.txt with an explicit AI stance, sitemap
 *       entries with honest lastmod, schema.org JSON-LD builders and script-safe serialization,
 *       and llms.txt. No runtime imports: Next's types only, so it runs anywhere.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export { clampDescription, DESCRIPTION_MAX } from "./describe.js";
export { ld, serializeLd } from "./ld.js";
export type {
  CreativeWorkOptions,
  DatasetOptions,
  HowToOptions,
  LdAgent,
  TechArticleOptions,
} from "./ld-content.js";
export {
  type LdGraph,
  type LdLink,
  type LdNode,
  SEARCH_TERM,
  type WebApplicationOptions,
} from "./ld-site.js";
export {
  type LlmsFullPart,
  type LlmsLink,
  type LlmsSection,
  type LlmsTxtOptions,
  llmsFull,
  llmsTxt,
  type TextResponseOptions,
  textResponse,
} from "./llms.js";
export {
  homeMetadata,
  notFoundMetadata,
  type PageMetadataOptions,
  pageMetadata,
  siteMetadata,
} from "./metadata.js";
export {
  AI_BOTS,
  type AiBot,
  type AiBotKind,
  type AiBotsPolicy,
  type RobotsOptions,
  robots,
} from "./robots.js";
export {
  HARUHIME_ORG,
  type OgImage,
  type Organization,
  pageTitle,
  type Site,
  TITLE_MAX,
  TITLE_SEPARATOR,
  type TitleSuffixMode,
} from "./site.js";
export {
  type ChangeFrequency,
  SITEMAP_MAX_URLS,
  type SitemapGroup,
  type SitemapRecord,
  sitemapEntries,
} from "./sitemap.js";
