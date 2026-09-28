/**
 * @file tests/server/rate-limit.test.ts
 * @desc createRateLimiter against the in-memory MongoDB: pools' cases
 *       (tests/integration/lib/rate-limit.test.ts: limits, 429, cost, failing open) and packs'
 *       counter clean-up on account deletion, now deleteSubject.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { ensureIndexes } from "../../src/mongo/index.js";
import {
  counterTtlIndex,
  createRateLimiter,
  RATE_LIMITS_COLLECTION,
  rateLimitHeaders,
  rateLimitId,
} from "../../src/server/index.js";
import { testDatabase } from "../helpers/db.js";

const { db, connectedDb } = testDatabase("rate-limit");

const RULE = { scope: "test", limit: 2, windowSeconds: 60 };
const NOW = new Date("2026-09-24T12:00:30.000Z").getTime();
let clock = NOW;
const limiter = createRateLimiter({ db: connectedDb, now: () => clock });

describe("hit", () => {
  it("allows up to the limit per subject and window", async () => {
    clock = NOW;
    expect(await limiter.hit(RULE, "1.2.3.4")).toMatchObject({
      allowed: true,
      remaining: 1,
      resetSeconds: 30,
    });
    expect(await limiter.hit(RULE, "1.2.3.4")).toMatchObject({ allowed: true, remaining: 0 });
    const refused = await limiter.hit(RULE, "1.2.3.4");
    expect(refused).toMatchObject({ allowed: false, remaining: 0 });
    expect(rateLimitHeaders(refused)).toEqual({
      "RateLimit-Limit": "2",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": "30",
      "Retry-After": "30",
    });
    expect(await limiter.hit(RULE, "5.6.7.8")).toMatchObject({ allowed: true });
    clock = new Date("2026-09-24T12:01:01.000Z").getTime();
    expect(await limiter.hit(RULE, "1.2.3.4")).toMatchObject({ allowed: true });
  });

  it("stores one counter per window, expiring a minute after it", async () => {
    clock = NOW;
    await limiter.hit(RULE, "1.2.3.4");
    const doc = await db().collection(RATE_LIMITS_COLLECTION).findOne({});
    expect(doc).toEqual({
      _id: rateLimitId(RULE, "1.2.3.4", NOW),
      count: 1,
      expiresAt: new Date("2026-09-24T12:02:00.000Z"),
    });
  });

  it("counts a hit's cost, refusing one that would go past the limit", async () => {
    clock = NOW;
    const rule = { scope: "cost", limit: 5, windowSeconds: 60 };
    expect(await limiter.hit(rule, "u1", 3)).toMatchObject({ allowed: true, remaining: 2 });
    expect(await limiter.hit(rule, "u1", 3)).toMatchObject({ allowed: false, remaining: 0 });
    expect(await limiter.refuseOverLimit(rule, "u2", 5)).toBeNull();
    expect((await limiter.refuseOverLimit(rule, "u2", 1))?.status).toBe(429);
  });

  it("counts two first hits racing for one window once each", async () => {
    clock = NOW;
    const rule = { scope: "race", limit: 10, windowSeconds: 60 };
    await Promise.all(Array.from({ length: 8 }, () => limiter.hit(rule, "r")));
    const doc = await db().collection(RATE_LIMITS_COLLECTION).findOne({});
    expect(doc?.count).toBe(8);
  });
});

describe("counterTtlIndex", () => {
  it("expires counters at expiresAt, in any collection", async () => {
    expect(counterTtlIndex("limits").collection).toBe("limits");
    expect(await ensureIndexes(db(), [counterTtlIndex()])).toEqual({
      built: ["expiresAt_1"],
      skipped: [],
    });
    const indexes = await db().collection(RATE_LIMITS_COLLECTION).indexes();
    expect(indexes.find((index) => index.name === "expiresAt_1")?.expireAfterSeconds).toBe(0);
  });
});

describe("refuseOverLimit", () => {
  it("answers 429 no-store once over", async () => {
    clock = NOW;
    await limiter.refuseOverLimit(RULE, "9.9.9.9");
    expect(await limiter.refuseOverLimit(RULE, "9.9.9.9")).toBeNull();
    const response = await limiter.refuseOverLimit(RULE, "9.9.9.9");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("retry-after")).toBe("30");
  });
});

describe("failures", () => {
  it("fails open and logs when the database is down", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const down = createRateLimiter({ db: () => Promise.reject(new Error("down")), now: () => NOW });
    expect(await down.hit(RULE, "1.1.1.1")).toMatchObject({ allowed: true, remaining: 2 });
    expect(await down.refuseOverLimit(RULE, "1.1.1.1")).toBeNull();
    expect(quiet).toHaveBeenCalledWith("rate limit: couldn't count test", expect.any(Error));
    quiet.mockRestore();
  });

  it("retries a duplicate key once, and fails open on any other error", async () => {
    const duplicate = Object.assign(new Error("E11000"), { code: 11000 });
    const findOneAndUpdate = vi
      .fn()
      .mockRejectedValueOnce(duplicate)
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("timeout"));
    const fake = { collection: () => ({ findOneAndUpdate }) } as never;
    const mocked = createRateLimiter({ db: async () => fake, now: () => NOW });
    expect(await mocked.hit(RULE, "d")).toMatchObject({ allowed: true, remaining: 0 });
    expect(await mocked.hit(RULE, "d", 2)).toMatchObject({ allowed: true, remaining: 0 });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await mocked.hit(RULE, "d")).toMatchObject({ allowed: true, remaining: 2 });
    quiet.mockRestore();
    expect(findOneAndUpdate).toHaveBeenCalledTimes(4);
  });
});

describe("deleteSubject", () => {
  const API = { scope: "api", limit: 60, windowSeconds: 60 };
  const WRITE = { scope: "api-write", limit: 30, windowSeconds: 60 };
  const GLOBAL = { scope: "osu-api", limit: 50, windowSeconds: 60 };

  it("removes only that subject's counters under the given rules", async () => {
    clock = NOW;
    const user = "0123456789abcdef01234567";
    await limiter.hit(API, user);
    await limiter.hit(WRITE, user);
    await limiter.hit(API, `${user}0`);
    await limiter.hit(API, "other");
    await limiter.hit(GLOBAL, "global");
    await limiter.hit(GLOBAL, user);
    expect(await limiter.deleteSubject([API, WRITE], user)).toBe(2);
    const left = await db().collection(RATE_LIMITS_COLLECTION).find().toArray();
    expect(left.map((doc) => String(doc._id).split(":").slice(0, 2).join(":")).sort()).toEqual([
      `api:${user}0`,
      "api:other",
      `osu-api:${user}`,
      "osu-api:global",
    ]);
  });

  it("reads a subject's regex characters literally", async () => {
    clock = NOW;
    await limiter.hit(API, "a.b");
    await limiter.hit(API, "axb");
    expect(await limiter.deleteSubject([API], ".*")).toBe(0);
    expect(await limiter.deleteSubject([API], "a.b")).toBe(1);
    expect(await limiter.deleteSubject([], "axb")).toBe(0);
  });
});
