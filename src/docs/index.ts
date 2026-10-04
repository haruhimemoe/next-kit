/**
 * @file src/docs/index.ts
 * @desc @haruhimemoe/next-kit/docs: the content registry (sections, entries, app-made extras)
 *       and the path helpers every docs, guides and legal page is built from. Pure: no node:
 *       imports, so it runs in any route, edge or browser. File-backed markdown reading lives
 *       under the separate `docs/files` entry point.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

export {
  CONTENT_SECTIONS,
  type Content,
  type ContentEntry,
  type ContentInput,
  type ContentSection,
  contentParams,
  contentPath,
  defineContent,
  type ExtraEntry,
  findEntry,
  type HowToStep,
  markdownPath,
  SECTION_LABELS,
} from "./registry.js";
