/**
 * @file src/server/budget.ts
 * @desc A shared call budget, like the osu! API's: a global fixed window across every instance
 *       and, optionally, each subject's share, counted in the same documents as rate limits. The
 *       share is counted first, and a subject past its share never touches the global counter,
 *       so one caller can't spend the budget for everyone. gate() is the beforeCall a request
 *       hands @haruhimemoe/osu: once it says no, it says no for the rest of that request, and a
 *       counter it can't write counts as no. Moved from pools (src/lib/osu-budget.ts) and packs
 *       (src/lib/osu/attributes.ts), which held the same functions around their own constants.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { bumpCounter, type CounterStore, type RateLimitRule } from "./counter.js";

/** createBudget's options. */
export type BudgetOptions = CounterStore & {
  /** The budget every caller shares (osu!: 50 calls a minute). */
  global: RateLimitRule;
  /** The subject the global counter is kept under (default "global"). */
  globalSubject?: string;
  /** Each subject's share, when one is passed (osu!: 20 calls a minute per IP). */
  perSubject?: RateLimitRule;
};

/** What createBudget returns. */
export type Budget = {
  /**
   * Takes one call from the budget: true when it fits the subject's share (when a subject is
   * given) and the global window. Throws when a counter can't be written.
   */
  take: (subject?: string, nowMs?: number) => Promise<boolean>;
  /** A beforeCall: true while the budget allows, false from its first no (or failure) on. */
  gate: (subject?: string, now?: () => number) => () => Promise<boolean>;
};

/**
 * @function createBudget
 * @param options {BudgetOptions} the counters' store, the global rule and the per-subject share
 * @returns {Budget} take and gate over those counters
 */
export const createBudget = ({
  global,
  globalSubject = "global",
  perSubject,
  ...store
}: BudgetOptions): Budget => {
  const take = async (subject?: string, nowMs: number = Date.now()): Promise<boolean> => {
    if (subject !== undefined && perSubject) {
      const used = await bumpCounter(store, perSubject, subject, nowMs, 1);
      if (used > perSubject.limit) return false;
    }
    return (await bumpCounter(store, global, globalSubject, nowMs, 1)) <= global.limit;
  };
  const gate = (subject?: string, now: () => number = Date.now) => {
    let refused = false;
    return async (): Promise<boolean> => {
      if (refused) return false;
      try {
        if (await take(subject, now())) return true;
      } catch (error) {
        console.error(`[${global.scope}] budget: couldn't count`, error);
      }
      refused = true;
      return false;
    };
  };
  return { take, gate };
};
