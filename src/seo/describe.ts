/**
 * @file src/seo/describe.ts
 * @desc Meta descriptions: one line, at most 160 characters, cut at a word with "…" and no
 *       dangling comma, colon or dash before it (audit O4: pools served a 248-character default).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** The longest description search results show in full. */
export const DESCRIPTION_MAX = 160;

const ELLIPSIS = "…";

/** Punctuation, dashes and open brackets that shouldn't sit right before the "…". */
const TRAILING = /[\s,;:.!?\-–—(["'“‘/&+]+$/u;

/**
 * @function clampDescription
 * @param text {string} the description, maybe long or spread over lines
 * @param max {number} the longest result, "…" included (default 160)
 * @returns {string} the text on one line; when it's longer than max, cut at the last word that
 *          fits, trailing punctuation dropped, and "…" added. A single word longer than max is
 *          cut mid-word.
 * @throws {RangeError} when max is under 2
 */
export const clampDescription = (text: string, max: number = DESCRIPTION_MAX): string => {
  if (!Number.isInteger(max) || max < 2) throw new RangeError("seo: max must be 2 or more");
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  const room = line.slice(0, max - ELLIPSIS.length + 1);
  const space = room.lastIndexOf(" ");
  const cut = space > 0 ? room.slice(0, space) : room.slice(0, max - ELLIPSIS.length);
  const clean = cut.replace(TRAILING, "");
  return `${clean || cut}${ELLIPSIS}`;
};
