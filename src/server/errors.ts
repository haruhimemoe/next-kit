/**
 * @file src/server/errors.ts
 * @desc The JSON error answer every route sends ({ error: { code, message } }), the stable code
 *       per status, and two small header helpers (no-store, set several headers at once).
 *       Moved from packs and pools (src/lib/api.ts, src/lib/rate-limit.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** Stable machine codes per status. Messages are for people and may change; codes don't. */
export const ERROR_CODES = Object.freeze({
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
  500: "internal_error",
  502: "upstream_error",
  503: "unavailable",
} as const satisfies Record<number, string>);

/** The body of every error answer. */
export type ApiErrorBody = { error: { code: string; message: string } };

/**
 * @function errorCodeFor
 * @param status {number} HTTP status
 * @returns {string} its code from ERROR_CODES; otherwise "internal_error" for 5xx, "bad_request"
 */
export const errorCodeFor = (status: number): string =>
  (ERROR_CODES as Record<number, string>)[status] ??
  (status >= 500 ? "internal_error" : "bad_request");

/**
 * @function jsonError
 * @param status {number} HTTP status
 * @param message {string} shown to the person
 * @param code {string} machine code (default: from the status)
 * @returns {Response} `{ error: { code, message } }` JSON
 */
export const jsonError = (
  status: number,
  message: string,
  code: string = errorCodeFor(status),
): Response => Response.json({ error: { code, message } } satisfies ApiErrorBody, { status });

/**
 * @function withHeaders
 * @param response {Response} a response with mutable headers
 * @param headers {Record<string, string>} headers to set
 * @returns {Response} the same response
 */
export const withHeaders = (response: Response, headers: Record<string, string>): Response => {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
};

/**
 * @function noStore
 * @param response {Response} a response with mutable headers
 * @returns {Response} the same response, never cached
 */
export const noStore = (response: Response): Response =>
  withHeaders(response, { "Cache-Control": "no-store" });
