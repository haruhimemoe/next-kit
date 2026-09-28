/**
 * @file tests/server/budget.test.ts
 * @desc createBudget against the in-memory MongoDB: packs' budget cases
 *       (tests/integration/lib/osu-attributes.test.ts: the window ids, the global count, the
 *       per-subject share) and pools' gate latch (src/lib/osu-budget.ts), with the apps' osu!
 *       numbers (50 a minute, 20 per IP).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { createBudget, RATE_LIMITS_COLLECTION, rateLimitId } from "../../src/server/index.js";
import { testDatabase } from "../helpers/db.js";

const { db, connectedDb } = testDatabase("budget");

const GLOBAL = { scope: "osu-api", limit: 50, windowSeconds: 60 };
const PER_IP = { scope: "osu-api-ip", limit: 20, windowSeconds: 60 };
const NOW = Date.parse("2026-09-22T12:00:10.250Z");
const budget = createBudget({ db: connectedDb, global: GLOBAL, perSubject: PER_IP });
const counters = () => db().collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION);
const globalId = rateLimitId(GLOBAL, "global", NOW);

describe("take", () => {
  it("keeps the rate-limit id shape scope:subject:windowStartSeconds", async () => {
    await budget.take(undefined, NOW);
    await budget.take("203.0.113.9", NOW);
    const start = Date.parse("2026-09-22T12:00:00.000Z") / 1000;
    const docs = await counters().find().sort({ _id: 1 }).toArray();
    expect(docs.map((doc) => doc._id)).toEqual([
      `osu-api-ip:203.0.113.9:${start}`,
      `osu-api:global:${start}`,
    ]);
  });

  it("counts every call in the window", async () => {
    for (let i = 0; i < GLOBAL.limit; i++) expect(await budget.take(undefined, NOW)).toBe(true);
    expect(await budget.take(undefined, NOW)).toBe(false);
    expect((await counters().findOne({ _id: globalId }))?.count).toBe(51);
  });

  it("refuses a subject past its share without touching the global counter", async () => {
    for (let i = 0; i < PER_IP.limit; i++) expect(await budget.take("203.0.113.9", NOW)).toBe(true);
    expect(await budget.take("203.0.113.9", NOW)).toBe(false);
    expect((await counters().findOne({ _id: globalId }))?.count).toBe(20);
    expect(await budget.take("198.51.100.7", NOW)).toBe(true);
    expect((await counters().findOne({ _id: globalId }))?.count).toBe(21);
  });

  it("still refuses when the global budget is spent, even with share left", async () => {
    await counters().insertOne({ _id: globalId, count: GLOBAL.limit });
    expect(await budget.take("203.0.113.9", NOW)).toBe(false);
  });

  it("counts only the global window without a share rule, under the caller's subject name", async () => {
    const shared = createBudget({ db: connectedDb, global: GLOBAL, globalSubject: "all" });
    expect(await shared.take("203.0.113.9", NOW)).toBe(true);
    const docs = await counters().find().toArray();
    expect(docs.map((doc) => doc._id)).toEqual([rateLimitId(GLOBAL, "all", NOW)]);
  });

  it("throws when a counter can't be written", async () => {
    const down = createBudget({ db: () => Promise.reject(new Error("down")), global: GLOBAL });
    await expect(down.take()).rejects.toThrow("down");
  });
});

describe("gate", () => {
  it("says yes while the budget allows, then no for the rest of the request", async () => {
    await counters().insertOne({ _id: globalId, count: GLOBAL.limit - 2 });
    const gate = budget.gate(undefined, () => NOW);
    expect(await gate()).toBe(true);
    expect(await gate()).toBe(true);
    expect(await gate()).toBe(false);
    await counters().deleteMany({});
    expect(await gate()).toBe(false);
    expect(await counters().countDocuments()).toBe(0);
    expect(await budget.gate(undefined, () => NOW)()).toBe(true);
  });

  it("counts a counter it can't write as no, and logs it", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = createBudget({ db: () => Promise.reject(new Error("down")), global: GLOBAL });
    const gate = down.gate("203.0.113.9");
    expect(await gate()).toBe(false);
    expect(await gate()).toBe(false);
    expect(quiet).toHaveBeenCalledTimes(1);
    expect(quiet).toHaveBeenCalledWith("[osu-api] budget: couldn't count", expect.any(Error));
    quiet.mockRestore();
  });
});
