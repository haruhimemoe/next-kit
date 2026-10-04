/**
 * @file tests/api-keys/store.test.ts
 * @desc createApiKeyStore against the in-memory MongoDB: packs' cases
 *       (tests/integration/services/api-keys.test.ts) with the user lookup left to the app.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { hashApiKey } from "../../src/api-keys/format.js";
import { API_KEYS_COLLECTION, createApiKeyStore } from "../../src/api-keys/store.js";
import { testDatabase } from "../helpers/db.js";

const { db, connectedDb } = testDatabase("api-keys");
let clock = Date.parse("2026-10-03T12:00:00.000Z");
const store = createApiKeyStore({ prefix: "hpl_", db: connectedDb, now: () => clock });
const userId = new ObjectId().toString();
const docs = () => db().collection(API_KEYS_COLLECTION);

describe("createApiKeyStore", () => {
  it("refuses a bad prefix", () => {
    expect(() => createApiKeyStore({ prefix: "pk1.", db: connectedDb })).toThrow(TypeError);
  });
});

describe("issue", () => {
  it("stores only the hash and display prefix, and returns the key once", async () => {
    const { key, apiKey } = await store.issue(userId);
    expect(key).toMatch(/^hpl_[A-Za-z0-9_-]{43}$/);
    expect(apiKey).toEqual({
      prefix: key.slice(0, 12),
      createdAt: "2026-10-03T12:00:00.000Z",
      lastUsedAt: null,
    });
    const doc = await docs().findOne({ userId: new ObjectId(userId) });
    expect(doc?.hash).toBe(hashApiKey(key));
    expect(JSON.stringify(doc)).not.toContain(key);
  });

  it("replaces the old key and clears lastUsedAt", async () => {
    const first = await store.issue(userId);
    await (await store.authenticate(first.key))?.stamp();
    const second = await store.issue(userId);
    expect(await store.authenticate(first.key)).toBeNull();
    expect((await store.authenticate(second.key))?.userId).toBe(userId);
    expect(await docs().countDocuments()).toBe(1);
  });

  it("leaves exactly one key when two issues race", async () => {
    await store.ensureIndexes();
    await Promise.all([store.issue(userId), store.issue(userId), store.issue(userId)]);
    expect(await docs().countDocuments({ userId: new ObjectId(userId) })).toBe(1);
  });
});

describe("info and revoke", () => {
  it("shows the key's info, then nothing after revoke", async () => {
    expect(await store.info(userId)).toBeNull();
    await store.issue(userId);
    expect((await store.info(userId))?.prefix).toMatch(/^hpl_/);
    expect(await store.revoke(userId)).toBe(true);
    expect(await store.revoke(userId)).toBe(false);
    expect(await store.info(userId)).toBeNull();
  });
});

describe("authenticate", () => {
  it("returns null for another app's prefix without a lookup", async () => {
    const other = createApiKeyStore({ prefix: "hpk_", db: () => Promise.reject(new Error("no")) });
    expect(await other.authenticate(`hpl_${"A".repeat(43)}`)).toBeNull();
  });

  it("returns null for an unknown key", async () => {
    expect(await store.authenticate(`hpl_${"A".repeat(43)}`)).toBeNull();
  });

  it("doesn't stamp until stamp() is called", async () => {
    const { key } = await store.issue(userId);
    await store.authenticate(key);
    expect((await store.info(userId))?.lastUsedAt).toBeNull();
  });

  it("stamps lastUsedAt at most once an hour", async () => {
    const { key } = await store.issue(userId);
    const use = async () => (await store.authenticate(key))?.stamp();
    await use();
    const stamped = (await store.info(userId))?.lastUsedAt;
    expect(stamped).toBe("2026-10-03T12:00:00.000Z");
    clock += 30 * 60_000;
    await use();
    expect((await store.info(userId))?.lastUsedAt).toBe(stamped);
    clock += 31 * 60_000;
    await use();
    expect((await store.info(userId))?.lastUsedAt).toBe("2026-10-03T13:01:00.000Z");
  });

  it("doesn't stamp a key regenerated between lookup and stamp", async () => {
    const { key } = await store.issue(userId);
    const match = await store.authenticate(key);
    await docs().updateOne({ hash: hashApiKey(key) }, { $set: { hash: "replaced" } });
    await match?.stamp();
    expect((await docs().findOne({ hash: "replaced" }))?.lastUsedAt).toBeUndefined();
  });

  it("lists the two unique indexes", async () => {
    const { apiKeyIndexSpecs } = await import("../../src/api-keys/store.js");
    expect(apiKeyIndexSpecs().map((spec) => [spec.key, spec.unique])).toEqual([
      [{ userId: 1 }, true],
      [{ hash: 1 }, true],
    ]);
  });
});

describe("deleteFor", () => {
  it("removes the user's key", async () => {
    await store.issue(userId);
    expect(await store.deleteFor(userId)).toBe(1);
    expect(await docs().countDocuments()).toBe(0);
  });
});
