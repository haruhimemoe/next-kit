/**
 * @file src/server/body.ts
 * @desc Reading what a route is sent. parseJsonBody takes application/json only (a cross-site
 *       form can't send it without a CORS preflight), at most 16 KB unless the route gives its
 *       own cap, and a zod schema (pass z.strictObject so unknown keys are refused); a schema
 *       refusal's code is the one its refinement names in `params.code`, like content_filter.
 *       parseIdList reads `?ids=1,2,3`. Moved from pools (src/lib/api.ts), which had packs'
 *       version plus the cap option, the named codes and a strict id parser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { z } from "zod";
import { jsonError } from "./errors.js";

/** The default body cap: a 64-slot pack or an admin edit is under 3 KB of JSON. */
export const MAX_BODY_BYTES = 16_384;

/** What parseJsonBody gives back: the parsed data, or an error answer ready to send. */
export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

/** parseJsonBody's options. */
export type ParseJsonBodyOptions = {
  /** The 413 message (default "That request is too large."). */
  tooLarge?: string;
  /** The cap in bytes (default MAX_BODY_BYTES). */
  maxBytes?: number;
};

/**
 * @function parseJsonBody
 * @param request {Request} incoming request
 * @param schema {z.ZodType} what the body must be
 * @param options {ParseJsonBodyOptions} the 413 message and the cap
 * @returns {Promise<ParsedBody<z.output<T>>>} parsed data, or a 415, 413 or 400 answer: the
 *          400's message is the first issue's, its code the refinement's `params.code` if it's a
 *          string, else bad_request
 */
export const parseJsonBody = async <T extends z.ZodType>(
  request: Request,
  schema: T,
  { tooLarge = "That request is too large.", maxBytes = MAX_BODY_BYTES }: ParseJsonBodyOptions = {},
): Promise<ParsedBody<z.output<T>>> => {
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith("application/json")) {
    return { ok: false, response: jsonError(415, "Send the request as JSON.") };
  }
  // Refuse an honest oversized body before reading it; still measure what actually arrived.
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return { ok: false, response: jsonError(413, tooLarge) };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, response: jsonError(413, tooLarge) };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, "That request wasn't valid JSON.") };
  }
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  const named = issue?.code === "custom" ? issue.params?.code : undefined;
  return {
    ok: false,
    response: jsonError(
      400,
      issue?.message ?? "That request isn't valid.",
      typeof named === "string" ? named : undefined,
    ),
  };
};

/** The largest id an osu! beatmap (or any 32-bit signed id) can have. */
export const MAX_ID = 2_147_483_647;

/** parseIdList's options. */
export type ParseIdListOptions = {
  /** At most this many ids. */
  max: number;
  /** Whether one id is acceptable (default: 1 to MAX_ID). */
  isValid?: (id: number) => boolean;
};

const isPositiveId = (id: number): boolean => id >= 1 && id <= MAX_ID;

/**
 * @function parseIdList
 * @param raw {string | null} a comma-separated query value, like `?ids=`
 * @param options {ParseIdListOptions} the most ids and the per-id check
 * @returns {number[] | null} 1 to `max` ids in the order sent, each 1 to 10 plain digits and
 *          valid; null for anything else (an empty part, spaces, signs, hex, exponents, too many)
 */
export const parseIdList = (
  raw: string | null,
  { max, isValid = isPositiveId }: ParseIdListOptions,
): number[] | null => {
  // The longest valid id (10 digits) plus a comma; a longer value is refused unread.
  if (raw === null || raw.length > max * 11) return null;
  const parts = raw.split(",");
  if (parts.some((part) => !/^\d{1,10}$/.test(part))) return null;
  const ids = parts.map(Number);
  return ids.length <= max && ids.every(isValid) ? ids : null;
};
