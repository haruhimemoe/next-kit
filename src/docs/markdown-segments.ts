/**
 * @file src/docs/markdown-segments.ts
 * @desc Fence-aware line segmenting for mdxToMarkdown, split out to keep markdown.ts under 200
 *       lines: splits text into fence and prose runs (a fence may be indented, e.g. under a list
 *       item), and merges a <Callout> opened in one prose segment with its closing tag in a
 *       later segment (because its body holds a fenced code block) into one already-converted
 *       blockquote segment. Pure: no node: imports.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

/** One run of consecutive lines, either inside a fence (left alone) or prose (converted). */
export type Segment = { readonly isFence: boolean; readonly lines: readonly string[] };

const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})/;
const CALLOUT_OPEN_OR_CLOSE = /<Callout([^>]*)>|<\/Callout>/g;
const CALLOUT_CLOSE_TAG = "</Callout>";

/**
 * @function segmentFences
 * @param text {string} the MDX prose, after transforms and newline normalization
 * @returns {Segment[]} fence and prose runs, in order; a fence's opening indentation is not
 *   required on its closing line, only the same marker character repeated at least as many times
 */
export const segmentFences = (text: string): Segment[] => {
  const lines = text.split("\n");
  const segments: Segment[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;
    const open = line.match(FENCE_OPEN);
    if (!open) {
      const prose: string[] = [];
      while (i < lines.length) {
        const proseLine = lines[i];
        if (proseLine === undefined || FENCE_OPEN.test(proseLine)) break;
        prose.push(proseLine);
        i++;
      }
      segments.push({ isFence: false, lines: prose });
      continue;
    }
    const marker = open[2]?.[0] ?? "`";
    const minLength = open[2]?.length ?? 3;
    const close = new RegExp(`^\\s*${marker}{${minLength},}\\s*$`);
    const fence: string[] = [line];
    i++;
    while (i < lines.length) {
      const fenceLine = lines[i];
      if (fenceLine === undefined) break;
      fence.push(fenceLine);
      const isClose = close.test(fenceLine);
      i++;
      if (isClose) break;
    }
    segments.push({ isFence: true, lines: fence });
  }
  return segments;
};

/** The start index and attributes of a `<Callout>` opened but not closed within `text`. */
type UnmatchedCallout = { readonly start: number; readonly attrs: string };

/** Finds a trailing `<Callout>` open tag in `text` with no matching `</Callout>` after it. */
const findUnmatchedCallout = (text: string): UnmatchedCallout | null => {
  let depth = 0;
  let pending: UnmatchedCallout | null = null;
  CALLOUT_OPEN_OR_CLOSE.lastIndex = 0;
  let match = CALLOUT_OPEN_OR_CLOSE.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) {
      if (depth === 0) pending = { start: match.index, attrs: match[1] };
      depth++;
    } else {
      depth = Math.max(0, depth - 1);
      if (depth === 0) pending = null;
    }
    match = CALLOUT_OPEN_OR_CLOSE.exec(text);
  }
  return depth > 0 ? pending : null;
};

/**
 * @function mergeCalloutSegments
 * @param segments {Segment[]} the result of `segmentFences`
 * @param toBlockquote {(attrs: string, body: string) => string} rule 3's attrs+body-to-blockquote
 *   converter
 * @returns {Segment[]} the same segments, except a `<Callout>` opened in one prose segment and
 *   closed in a later one (its body holds a fenced code block, so `segmentFences` split it out)
 *   becomes a single, already-converted blockquote segment
 */
export const mergeCalloutSegments = (
  segments: Segment[],
  toBlockquote: (attrs: string, body: string) => string,
): Segment[] => {
  const merged: Segment[] = [];
  let pending: string[] | null = null;
  for (const segment of segments) {
    if (pending !== null) {
      pending.push(...segment.lines);
      const joined = pending.join("\n");
      const closeAt = joined.indexOf(CALLOUT_CLOSE_TAG);
      if (closeAt === -1) continue;
      const calloutText = joined.slice(0, closeAt + CALLOUT_CLOSE_TAG.length);
      const remainder = joined.slice(closeAt + CALLOUT_CLOSE_TAG.length);
      const match = /^<Callout([^>]*)>([\s\S]*)<\/Callout>$/.exec(calloutText);
      const blockquote = match ? toBlockquote(match[1] ?? "", match[2] ?? "") : calloutText;
      merged.push({ isFence: false, lines: blockquote.split("\n") });
      pending = null;
      if (remainder.length > 0) {
        const rest = mergeCalloutSegments(
          [{ isFence: false, lines: remainder.split("\n") }],
          toBlockquote,
        );
        merged.push(...rest);
      }
      continue;
    }
    if (segment.isFence) {
      merged.push(segment);
      continue;
    }
    const text = segment.lines.join("\n");
    const unmatched = findUnmatchedCallout(text);
    if (!unmatched) {
      merged.push(segment);
      continue;
    }
    const before = text.slice(0, unmatched.start);
    if (before.length > 0) merged.push({ isFence: false, lines: before.split("\n") });
    pending = text.slice(unmatched.start).split("\n");
  }
  if (pending !== null) merged.push({ isFence: false, lines: pending });
  return merged;
};
