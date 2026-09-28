/**
 * @file src/server/rate-limit.ts
 * @desc Fixed-window rate limits in MongoDB (src/server/counter.ts has the document). A hit can
 *       cost more than one (a call carrying several ops counts each). Subjects are IP subjects
 *       (client-ip.ts) or, for signed-in users, userSubject(). Counting fails open: if the write
 *       fails, the request is allowed and the error logged. Moved from pools
 *       (src/lib/rate-limit.ts, with db injection and cost) plus packs' deleteRateLimitsFor as
 *       deleteSubject.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  bumpCounter,
  type CounterStore,
  counters,
  type RateLimitRule,
  windowFor,
} from "./counter.js";
import { jsonError, noStore, withHeaders } from "./errors.js";

/** One counted hit. */
export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
};

/**
 * @function rateLimitHeaders
 * @param result {RateLimitResult} a counted hit
 * @returns {Record<string, string>} RateLimit-Limit/Remaining/Reset, plus Retry-After when refused
 */
export const rateLimitHeaders = (result: RateLimitResult): Record<string, string> => ({
  "RateLimit-Limit": String(result.limit),
  "RateLimit-Remaining": String(result.remaining),
  "RateLimit-Reset": String(result.resetSeconds),
  ...(result.allowed ? {} : { "Retry-After": String(result.resetSeconds) }),
});

/**
 * @function retryText
 * @param seconds {number} wait time
 * @returns {string} "45 seconds", "1 minute", "30 minutes"
 */
export const retryText = (seconds: number): string => {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

/**
 * @function tooManyRequests
 * @param result {RateLimitResult} a refused hit
 * @returns {Response} 429 rate_limited with every rate-limit header
 */
export const tooManyRequests = (result: RateLimitResult): Response =>
  withHeaders(
    jsonError(429, `Too many requests. Try again in ${retryText(result.resetSeconds)}.`),
    rateLimitHeaders(result),
  );

/**
 * @function userSubject
 * @param user {{ osuId: number }} a signed-in user
 * @returns {string} "osu:<osuId>", their subject for per-user limits and the osu! budget: it
 *          outlives their user id, which a deleted and re-made account doesn't keep
 */
export const userSubject = (user: { osuId: number }): string => `osu:${user.osuId}`;

/**
 * @function unlimited
 * @param rule {RateLimitRule} the limit
 * @param nowMs {number} current time (ms)
 * @returns {RateLimitResult} nothing counted: the full limit left (a hit that couldn't be counted,
 *          or a response that must carry headers before anything was counted)
 */
export const unlimited = (rule: RateLimitRule, nowMs: number): RateLimitResult => ({
  allowed: true,
  limit: rule.limit,
  remaining: rule.limit,
  resetSeconds: windowFor(rule, nowMs).resetSeconds,
});

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** createRateLimiter's options: where counters live, and a clock for tests. */
export type RateLimiterOptions = CounterStore & { now?: () => number };

/** What createRateLimiter returns. */
export type RateLimiter = {
  /** Counts a hit (cost 1 unless given); allowed while count <= limit, and when counting fails. */
  hit: (rule: RateLimitRule, subject: string, cost?: number) => Promise<RateLimitResult>;
  /** Counts a hit; a no-store 429 when it's over the limit, otherwise null. */
  refuseOverLimit: (
    rule: RateLimitRule,
    subject: string,
    cost?: number,
  ) => Promise<Response | null>;
  /** Removes a subject's counters under these rules (account deletion); resolves to how many. */
  deleteSubject: (rules: readonly RateLimitRule[], subject: string) => Promise<number>;
};

/**
 * @function createRateLimiter
 * @param options {RateLimiterOptions} the database (resolved per call), the collection (default
 *        rate_limits) and a clock (default Date.now)
 * @returns {RateLimiter} hit, refuseOverLimit and deleteSubject over those counters
 */
export const createRateLimiter = ({
  now = Date.now,
  ...store
}: RateLimiterOptions): RateLimiter => {
  const hit = async (rule: RateLimitRule, subject: string, cost = 1): Promise<RateLimitResult> => {
    const nowMs = now();
    const base = unlimited(rule, nowMs);
    try {
      const count = await bumpCounter(store, rule, subject, nowMs, cost);
      return { ...base, allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count) };
    } catch (error) {
      console.error(`rate limit: couldn't count ${rule.scope}`, error);
      return base;
    }
  };
  return {
    hit,
    refuseOverLimit: async (rule, subject, cost = 1) => {
      const result = await hit(rule, subject, cost);
      return result.allowed ? null : noStore(tooManyRequests(result));
    },
    deleteSubject: async (rules, subject) => {
      if (rules.length === 0) return 0;
      const scopes = rules.map((rule) => escapeRegExp(rule.scope)).join("|");
      // Anchored on both ends: a subject can't widen the pattern to another scope or subject.
      const pattern = `^(?:${scopes}):${escapeRegExp(subject)}:\\d+$`;
      const { deletedCount } = await (await counters(store)).deleteMany({
        _id: { $regex: pattern },
      });
      return deletedCount;
    },
  };
};
