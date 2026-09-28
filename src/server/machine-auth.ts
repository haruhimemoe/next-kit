/**
 * @file src/server/machine-auth.ts
 * @desc Bearer secrets for machine-only routes (a cron job, another app's service calls), which
 *       read no session or cookies. They fail closed: 503 not_configured while the secret isn't
 *       set or is invalid (logged by name, never by value), 401 for a missing or wrong one. The
 *       comparison hashes both sides with SHA-256 and compares the digests with timingSafeEqual,
 *       so the time taken says nothing about the secret's length or content. The secret is
 *       compared before any failure is counted, so the right one always gets through, even from
 *       an IP past its failure limit. Moved from packs (src/lib/machine-auth.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { EnvError } from "../env/errors.js";
import { clientIp, rateLimitSubject } from "./client-ip.js";
import type { RateLimitRule } from "./counter.js";
import { jsonError, noStore } from "./errors.js";
import { type RateLimiter, tooManyRequests } from "./rate-limit.js";

const BEARER = "Bearer ";

const digest = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

/**
 * @function sameSecret
 * @param given {string} what the request sent
 * @param secret {string} the configured secret
 * @returns {boolean} whether they're equal, compared as SHA-256 digests with timingSafeEqual
 */
export const sameSecret = (given: string, secret: string): boolean =>
  timingSafeEqual(digest(given), digest(secret));

/**
 * @function bearerToken
 * @param headers {Headers} request headers
 * @returns {string | null} what follows `Authorization: Bearer `, or null when there is none
 */
export const bearerToken = (headers: Headers): string | null => {
  const header = headers.get("authorization") ?? "";
  return header.startsWith(BEARER) && header.length > BEARER.length
    ? header.slice(BEARER.length)
    : null;
};

/** Counting a caller's failures: the limiter and the rule (per IP subject). */
export type BearerFailureLimit = { limiter: Pick<RateLimiter, "hit">; rule: RateLimitRule };

/** refuseWithoutBearer's options. */
export type BearerGuardOptions = {
  /** Reads the secret now; undefined while unset. An EnvError means set but invalid. */
  secret: () => string | undefined;
  /** Names the secret in the log line, like "cron" or "pools". */
  label: string;
  /** The 503 message while the secret isn't set up. */
  notConfigured: string;
  /** Counts a missing or wrong secret against the caller's IP: past the limit, 429 not 401. */
  failures?: BearerFailureLimit;
  /** Every refusal is no-store (default false). */
  noStore?: boolean;
};

/** The secret, or undefined when it's unset or invalid (logged by name, never by value). */
const configured = (read: () => string | undefined, label: string): string | undefined => {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    console.error(`[${label}] ${error.message}`);
    return undefined;
  }
};

/**
 * @function refuseWithoutBearer
 * @param request {Request} the incoming request
 * @param options {BearerGuardOptions} the secret, its label, the 503 message, failure counting
 * @returns {Promise<Response | null>} null when the request carries `Authorization: Bearer
 *          <secret>`, however often its IP failed; otherwise a 503 not_configured, a 401, or a
 *          429 when failures are counted and that IP is past the limit
 */
export const refuseWithoutBearer = async (
  request: Request,
  options: BearerGuardOptions,
): Promise<Response | null> => {
  const finish = (response: Response) => (options.noStore ? noStore(response) : response);
  const secret = configured(options.secret, options.label);
  if (!secret) return finish(jsonError(503, options.notConfigured, "not_configured"));
  const given = bearerToken(request.headers);
  if (given !== null && sameSecret(given, secret)) return null;
  if (options.failures) {
    const { limiter, rule } = options.failures;
    const result = await limiter.hit(rule, rateLimitSubject(clientIp(request.headers)));
    if (!result.allowed) return finish(tooManyRequests(result));
  }
  return finish(jsonError(401, "Not authorized."));
};
