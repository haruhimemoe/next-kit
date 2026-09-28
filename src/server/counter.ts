/**
 * @file src/server/counter.ts
 * @desc Fixed windows and the counter document rate limits and budgets share: one document per
 *       scope, subject and window (`{scope}:{subject}:{windowStartSeconds}`), bumped with one
 *       findOneAndUpdate upsert $inc, removed by the TTL index on expiresAt a minute after its
 *       window ends. Before, each app computed the window three times (rate limits and two osu!
 *       budget windows).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Collection, Db } from "mongodb";
import { isDuplicateKeyError } from "../mongo/duplicate.js";

/** A fixed-window limit: at most `limit` hits per `windowSeconds`, counted under `scope`. */
export type RateLimitRule = { scope: string; limit: number; windowSeconds: number };

/** The collection both apps keep counters in. */
export const RATE_LIMITS_COLLECTION = "rate_limits";

/** MongoDB's TTL monitor runs about once a minute; the grace keeps a live window's counter. */
export const COUNTER_GRACE_MS = 60_000;

/** One counter document. */
export type CounterDoc = { _id: string; count: number; expiresAt: Date };

/** Where a counter lives: the database (resolved per call) and the collection name. */
export type CounterStore = { db: () => Promise<Db>; collection?: string };

/** The window holding a moment, and when its counter may be removed. */
export type RateLimitWindow = { start: number; end: number; resetSeconds: number; expiresAt: Date };

/**
 * @function windowFor
 * @param rule {RateLimitRule} the limit
 * @param nowMs {number} current time (ms)
 * @returns {RateLimitWindow} the window holding nowMs; resetSeconds is 1 to windowSeconds
 */
export const windowFor = (rule: RateLimitRule, nowMs: number): RateLimitWindow => {
  const size = rule.windowSeconds * 1000;
  const start = Math.floor(nowMs / size) * size;
  const end = start + size;
  return {
    start,
    end,
    resetSeconds: Math.ceil((end - nowMs) / 1000),
    expiresAt: new Date(end + COUNTER_GRACE_MS),
  };
};

/**
 * @function rateLimitId
 * @param rule {RateLimitRule} the limit
 * @param subject {string} an IP subject, a user subject or a fixed one like "global"
 * @param nowMs {number} current time (ms)
 * @returns {string} "{scope}:{subject}:{windowStartSeconds}"
 */
export const rateLimitId = (rule: RateLimitRule, subject: string, nowMs: number): string =>
  `${rule.scope}:${subject}:${windowFor(rule, nowMs).start / 1000}`;

/**
 * @function counters
 * @param store {CounterStore} database and collection
 * @returns {Promise<Collection<CounterDoc>>} the counter collection
 */
export const counters = async ({
  db,
  collection = RATE_LIMITS_COLLECTION,
}: CounterStore): Promise<Collection<CounterDoc>> =>
  (await db()).collection<CounterDoc>(collection);

/**
 * @function bumpCounter
 * @param store {CounterStore} database and collection
 * @param rule {RateLimitRule} the limit
 * @param subject {string} who is counted
 * @param nowMs {number} current time (ms)
 * @param cost {number} how much to add
 * @returns {Promise<number>} the count after this bump
 * @throws when the counter can't be written
 */
export const bumpCounter = async (
  store: CounterStore,
  rule: RateLimitRule,
  subject: string,
  nowMs: number,
  cost: number,
): Promise<number> => {
  const collection = await counters(store);
  const bump = () =>
    collection.findOneAndUpdate(
      { _id: rateLimitId(rule, subject, nowMs) },
      { $inc: { count: cost }, $setOnInsert: { expiresAt: windowFor(rule, nowMs).expiresAt } },
      { upsert: true, returnDocument: "after" },
    );
  // Two first hits in a window can race to insert; the loser's retry finds the document.
  const doc = await bump().catch((error: unknown) => {
    if (!isDuplicateKeyError(error)) throw error;
    return bump();
  });
  return doc?.count ?? cost;
};
