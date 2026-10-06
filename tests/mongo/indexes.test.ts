/**
 * @file tests/mongo/indexes.test.ts
 * @desc ensureIndexes, ttlIndex, indexName and defineCollections: pools' cases
 *       (tests/integration/lib/db-indexes.test.ts: unique indexes hold, an index existing
 *       duplicates break is skipped and logged without secrets while the rest build) and both
 *       apps' TTL indexes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildIdentityIndexes,
  defineCollections,
  ensureIndexes,
  IDENTITY_INDEX_SPECS,
  IDENTITY_INDEXES,
  type IndexSpec,
  indexName,
  isDuplicateKeyError,
  ttlIndex,
} from "../../src/mongo/index.js";
import { testDatabase } from "../helpers/db.js";

const { db } = testDatabase("indexes");

const USER: IndexSpec = {
  collection: "user",
  key: { osuId: 1 },
  name: "user_osuId_unique",
  unique: true,
};
const TOKEN: IndexSpec = {
  collection: "session",
  key: { token: 1 },
  name: "session_token_unique",
  unique: true,
  secret: true,
};
const PAIR: IndexSpec = {
  collection: "account",
  key: { providerId: 1, accountId: -1 },
  unique: true,
};

const indexNamed = async (collection: string, name: string) =>
  (await db().collection(collection).indexes()).find((index) => index.name === name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureIndexes", () => {
  it("builds each index, and a unique one holds", async () => {
    const ttl = ttlIndex("session", "expiresAt", 0, "session_expiresAt_ttl");
    expect(await ensureIndexes(db(), [USER, PAIR, ttl])).toEqual({
      built: ["user_osuId_unique", "providerId_1_accountId_-1", "session_expiresAt_ttl"],
      skipped: [],
    });
    expect(await indexNamed("session", "session_expiresAt_ttl")).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    expect(await indexNamed("account", "providerId_1_accountId_-1")).toMatchObject({
      unique: true,
    });
    await db().collection("user").insertOne({ osuId: 5 });
    const error = await db()
      .collection("user")
      .insertOne({ osuId: 5 })
      .catch((e: unknown) => e);
    expect(isDuplicateKeyError(error)).toBe(true);
  });

  it("is a no-op the second time", async () => {
    await ensureIndexes(db(), [USER]);
    expect((await ensureIndexes(db(), [USER])).built).toEqual(["user_osuId_unique"]);
  });

  it("skips and logs an index existing duplicates break, and builds the rest", async () => {
    await db()
      .collection("user")
      .insertMany([{ osuId: 7 }, { osuId: 7 }]);
    await db()
      .collection("session")
      .insertMany([{ token: "secret-session-token" }, { token: "secret-session-token" }]);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = await ensureIndexes(db(), [USER, TOKEN, PAIR]);
    expect(report).toEqual({
      built: ["providerId_1_accountId_-1"],
      skipped: ["user_osuId_unique", "session_token_unique"],
    });
    const lines = logged.mock.calls.map((call) => call.map(String).join(" "));
    expect(lines.find((line) => line.includes("user_osuId_unique"))).toMatch(/osuId.*7/);
    expect(lines.some((line) => line.includes("session_token_unique"))).toBe(true);
    expect(lines.join("\n")).not.toContain("secret-session-token");
    expect(await indexNamed("user", "user_osuId_unique")).toBeUndefined();
  });

  it("logs any other failure without throwing, and never a secret's error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad: IndexSpec = { collection: "x", key: { a: 1 }, name: "bad", expireAfterSeconds: -5 };
    const report = await ensureIndexes(db(), [bad, { ...bad, name: "bad_secret", secret: true }]);
    expect(report.skipped).toEqual(["bad", "bad_secret"]);
    expect(logged).toHaveBeenCalledWith("db: couldn't create bad", expect.anything());
    expect(logged).toHaveBeenCalledWith("db: couldn't create bad_secret", "");
  });

  it("builds a partial index", async () => {
    const partial: IndexSpec = {
      collection: "pools",
      key: { slug: 1 },
      unique: true,
      partialFilterExpression: { slug: { $type: "string" } },
    };
    expect((await ensureIndexes(db(), [partial])).built).toEqual(["slug_1"]);
  });
});

describe("indexName and ttlIndex", () => {
  it("names an index like MongoDB does unless it has a name", () => {
    expect(indexName({ collection: "c", key: { a: 1, b: -1 } })).toBe("a_1_b_-1");
    expect(indexName(USER)).toBe("user_osuId_unique");
    expect(ttlIndex("rate_limits", "expiresAt")).toEqual({
      collection: "rate_limits",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
  });
});

describe("buildIdentityIndexes", () => {
  it("builds the four identity indexes on an identity database", async () => {
    const report = await buildIdentityIndexes(db());
    expect(report).toEqual({
      built: [
        IDENTITY_INDEXES.userOsuId,
        IDENTITY_INDEXES.sessionToken,
        IDENTITY_INDEXES.sessionTtl,
        IDENTITY_INDEXES.accountKey,
      ],
      skipped: [],
    });
    expect(await indexNamed("user", IDENTITY_INDEXES.userOsuId)).toMatchObject({ unique: true });
    expect(await indexNamed("session", IDENTITY_INDEXES.sessionToken)).toMatchObject({
      unique: true,
    });
    expect(await indexNamed("session", IDENTITY_INDEXES.sessionTtl)).toMatchObject({
      expireAfterSeconds: 0,
    });
    expect(await indexNamed("account", IDENTITY_INDEXES.accountKey)).toMatchObject({
      unique: true,
    });
  });

  it("names each spec after IDENTITY_INDEXES and marks the session token secret", () => {
    expect(IDENTITY_INDEX_SPECS.map((spec) => indexName(spec))).toEqual([
      IDENTITY_INDEXES.userOsuId,
      IDENTITY_INDEXES.sessionToken,
      IDENTITY_INDEXES.sessionTtl,
      IDENTITY_INDEXES.accountKey,
    ]);
    expect(
      IDENTITY_INDEX_SPECS.find((spec) => spec.collection === "session" && spec.unique),
    ).toMatchObject({ secret: true });
  });
});

describe("defineCollections", () => {
  it("freezes the names", () => {
    const names = defineCollections({ pools: "pools", rateLimits: "rate_limits" });
    expect(names.rateLimits).toBe("rate_limits");
    expect(Object.isFrozen(names)).toBe(true);
  });

  it.each([
    [{ a: "" }, "a isn't a valid name"],
    [{ a: "x$y" }, "a isn't a valid name"],
    [{ a: "system.users" }, "a isn't a valid name"],
    [{ a: "pools", b: "pools" }, 'b and a both name "pools"'],
  ])("refuses %j", (names, message) => {
    expect(() => defineCollections(names)).toThrow(`defineCollections: ${message}`);
  });
});
