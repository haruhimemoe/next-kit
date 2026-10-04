/**
 * @file src/docs/markdown.ts
 * @desc Converts bb-flavored MDX (<Callout>, capitalized JSX like <Example>, import/export lines)
 *       into plain Markdown for an app's generated .md pages: callouts become blockquotes,
 *       import/export lines are dropped, root-relative links and images become absolute with the
 *       site's origin, and a missing title heading is added. Pure: no node: imports, so it runs
 *       anywhere. Everything inside a fenced code block (``` or ~~~, 3+ characters, matched close,
 *       optionally indented) is left exactly as written; a `<Callout>` whose body holds one of
 *       those fences still converts to a blockquote (see markdown-segments.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { mergeCalloutSegments, segmentFences } from "./markdown-segments.js";

/** Options for `mdxToMarkdown`. */
export type MarkdownOptions = {
  title: string;
  siteUrl: string;
  /** Run first, over the whole raw source (bb's <Example>). */
  transforms?: readonly ((source: string) => string)[];
};

const EXPORT_OBJECT_OPEN = /^export\s+const\s+\S+\s*=\s*\{\s*$/;
const EXPORT_OBJECT_CLOSE = /^\}\s*;?\s*$/;
const IMPORT_OR_EXPORT = /^(?:import|export)\b/;
const CALLOUT = /<Callout([^>]*)>([\s\S]*?)<\/Callout>/g;
const CALLOUT_TYPE = /\btype="([^"]*)"/;
const JSX_TAG = /<\/?[A-Z][\w.]*(?:\s[^<>]*)?\s*\/?>/g;
const ROOT_LINK_TARGET = /\]\(\/(?!\/)([^)]*)\)/g;

const titleCase = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/** Rule 2: drops top-level import/export lines, and an export const object block. */
const dropImportExport = (text: string): string => {
  const lines = text.split("\n");
  const kept: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;
    if (EXPORT_OBJECT_OPEN.test(line)) {
      i++;
      while (i < lines.length) {
        const blockLine = lines[i];
        if (blockLine === undefined || EXPORT_OBJECT_CLOSE.test(blockLine)) break;
        i++;
      }
      i++;
      continue;
    }
    if (IMPORT_OR_EXPORT.test(line)) {
      i++;
      continue;
    }
    kept.push(line);
    i++;
  }
  return kept.join("\n");
};

/**
 * Rule 3: turns a `<Callout type="x" title="...">body</Callout>` match's attrs and body into a
 * blockquote: the label on the first line, every other body line (fence lines included, for a
 * callout whose body holds a fenced code block) prefixed with `> `.
 */
const calloutBodyToBlockquote = (attrs: string, body: string): string => {
  const type = CALLOUT_TYPE.exec(attrs)?.[1] ?? "note";
  const label = titleCase(type);
  const lines = body.replace(/^\n+/, "").replace(/\n+$/, "").split("\n");
  const [first = "", ...rest] = lines;
  return [`> **${label}:** ${first}`, ...rest.map((line) => `> ${line}`)].join("\n");
};

/** Rule 3: <Callout type="x" title="...">body</Callout> becomes a blockquote. */
const convertCallouts = (text: string): string =>
  text.replace(CALLOUT, (_match, attrs: string, body: string) =>
    calloutBodyToBlockquote(attrs, body),
  );

/** Rule 4: removes any other capitalized JSX tag, keeping the text between tags. */
const removeJsxTags = (text: string): string => text.replace(JSX_TAG, "");

/** Rule 5: a link or image target starting with a single "/" becomes absolute. */
const absolutizeRootLinks = (text: string, siteUrl: string): string =>
  text.replace(ROOT_LINK_TARGET, (_match, target: string) => `](${siteUrl}/${target})`);

const processProse = (text: string, siteUrl: string): string =>
  absolutizeRootLinks(removeJsxTags(convertCallouts(dropImportExport(text))), siteUrl);

/** Rule 6: prepends the title heading when the first non-blank line isn't one. */
const ensureTitle = (text: string, title: string): string => {
  const firstContentLine = text.split("\n").find((line) => line.trim() !== "");
  return firstContentLine?.startsWith("# ") ? text : `# ${title}\n\n${text}`;
};

/** Rule 7: collapses runs of 3+ blank lines to 2, then trims to exactly one trailing newline. */
const finalize = (text: string): string => {
  const lines = text.split("\n");
  const kept: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blankRun++;
      if (blankRun <= 2) kept.push(line);
    } else {
      blankRun = 0;
      kept.push(line);
    }
  }
  return `${kept.join("\n").trim()}\n`;
};

/**
 * @function mdxToMarkdown
 * @param source {string} the raw MDX source
 * @param options {MarkdownOptions} the fallback title, the site's origin for root-relative
 *   links and images, and any transforms to run first over the whole source
 * @returns {string} the converted Markdown: content inside fenced code blocks is untouched,
 *   import/export lines and other capitalized JSX are removed, callouts become blockquotes,
 *   root-relative links and images become absolute, a title heading is added when missing, and
 *   the result ends with exactly one trailing newline
 */
export const mdxToMarkdown = (source: string, options: MarkdownOptions): string => {
  const { title, siteUrl, transforms = [] } = options;
  let text = source.replace(/\r\n?/g, "\n");
  for (const transform of transforms) text = transform(text);
  text = text.replace(/\r\n?/g, "\n");

  const converted = mergeCalloutSegments(segmentFences(text), calloutBodyToBlockquote)
    .map((segment) =>
      segment.isFence ? segment.lines.join("\n") : processProse(segment.lines.join("\n"), siteUrl),
    )
    .join("\n");

  return finalize(ensureTitle(converted, title));
};
