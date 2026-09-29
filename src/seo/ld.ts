/**
 * @file src/seo/ld.ts
 * @desc The `ld` namespace of JSON-LD builders, and serializeLd: JSON that is safe inside a
 *       `<script>` tag. @haruhimemoe/ui's JsonLd escapes "<" only; serializeLd also escapes ">",
 *       "&" and U+2028/U+2029, so the output is safe in any HTML or JavaScript context.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { creativeWork, dataset, faq, howTo, techArticle } from "./ld-content.js";
import { breadcrumbs, graph, itemList, organization, webApplication, webSite } from "./ld-site.js";

/** The JSON-LD builders: plain schema.org objects, rendered with @haruhimemoe/ui's JsonLd. */
export const ld = {
  graph,
  organization,
  webSite,
  webApplication,
  breadcrumbs,
  itemList,
  faq,
  howTo,
  techArticle,
  creativeWork,
  dataset,
} as const;

const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * @function serializeLd
 * @param data {object} a JSON-LD document or node
 * @returns {string} JSON with <, >, & and U+2028/U+2029 written as \u escapes: the same data to
 *          a JSON parser, and nothing a `<script>` tag or an HTML comment can end on
 */
export const serializeLd = (data: object): string =>
  JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char] as string);
