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

/** The start/end index and attributes of a `<Callout>` opened but not closed within `text`. */
type UnmatchedCallout = { readonly start: number; readonly end: number; readonly attrs: string };

/** Finds a trailing `<Callout>` open tag in `text` with no matching `</Callout>` after it. */
const findUnmatchedCallout = (text: string): UnmatchedCallout | null => {
  let depth = 0;
  let pending: UnmatchedCallout | null = null;
  CALLOUT_OPEN_OR_CLOSE.lastIndex = 0;
  let match = CALLOUT_OPEN_OR_CLOSE.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) {
      if (depth === 0) {
        pending = { start: match.index, end: match.index + match[0].length, attrs: match[1] };
      }
      depth++;
    } else {
      depth = Math.max(0, depth - 1);
      if (depth === 0) pending = null;
    }
    match = CALLOUT_OPEN_OR_CLOSE.exec(text);
  }
  return depth > 0 ? pending : null;
};

/** One run of a `<Callout>` body: `isFence` chunks are kept byte-for-byte, others go through rule 4/5. */
type BodyChunk = { readonly isFence: boolean; readonly text: string };

/**
 * @function mergeCalloutSegments
 * @param segments {Segment[]} the result of `segmentFences`
 * @param processBodyProse {(text: string) => string} rules 4/5 (JSX removal, link absolutizing),
 *   run on every non-fence chunk of a merged callout's body before it is quoted; fence chunks of
 *   the body are passed to `toBlockquote` untouched
 * @param toBlockquote {(attrs: string, body: string) => string} rule 3's attrs+body-to-blockquote
 *   converter
 * @returns {Segment[]} the same segments, except a `<Callout>` opened in one prose segment and
 *   closed in a later one (its body holds a fenced code block, so `segmentFences` split it out)
 *   becomes a single, already-converted blockquote segment marked `isFence: true` so the caller
 *   does not run prose rules over it again
 */
export const mergeCalloutSegments = (
  segments: Segment[],
  processBodyProse: (text: string) => string,
  toBlockquote: (attrs: string, body: string) => string,
): Segment[] => {
  const merged: Segment[] = [];
  let attrs: string | null = null;
  let chunks: BodyChunk[] | null = null;
  for (const segment of segments) {
    if (chunks !== null) {
      const text = segment.lines.join("\n");
      const closeAt = segment.isFence ? -1 : text.indexOf(CALLOUT_CLOSE_TAG);
      if (closeAt === -1) {
        chunks.push({ isFence: segment.isFence, text });
        continue;
      }
      const bodyPart = text.slice(0, closeAt);
      const remainder = text.slice(closeAt + CALLOUT_CLOSE_TAG.length);
      if (bodyPart.length > 0) chunks.push({ isFence: false, text: bodyPart });
      const body = chunks
        .map((chunk) => (chunk.isFence ? chunk.text : processBodyProse(chunk.text)))
        .join("\n");
      const blockquote = toBlockquote(attrs ?? "", body);
      merged.push({ isFence: true, lines: blockquote.split("\n") });
      chunks = null;
      attrs = null;
      if (remainder.length > 0) {
        const rest = mergeCalloutSegments(
          [{ isFence: false, lines: remainder.split("\n") }],
          processBodyProse,
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
    attrs = unmatched.attrs;
    chunks = [{ isFence: false, text: text.slice(unmatched.end) }];
  }
  if (chunks !== null) {
    // Unterminated callout (malformed input): best-effort passthrough, raw.
    const body = chunks.map((chunk) => chunk.text).join("\n");
    merged.push({ isFence: false, lines: body.split("\n") });
  }
  return merged;
};
