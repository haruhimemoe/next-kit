/**
 * @file tests/check/migrate-identity.test.ts
 * @desc migrateIdentity against a seeded in-memory MongoDB: three apps (bb, packs, pools) each
 *       with their own user/account/session/api_keys rows, merged into one identity database by
 *       osuId (earliest createdAt wins), with userId references rewritten, old sessions
 *       dropped, API keys copied with scopes ["*"], and --drop-old cleanup. Dry run by default
 *       writes nothing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { type Db, MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { API_KEYS_COLLECTION } from "../../src/api-keys/store.js";
import { type MigrateAppSpec, migrateIdentity } from "../../src/check/migrate-identity.js";

const client = new MongoClient(inject("mongoUri"));
const appDb = (name: string): Db => client.db(`migrate-${name}`);
const identityDb = client.db("migrate-identity");

afterAll(() => client.close());

beforeEach(async () => {
  for (const name of ["bb", "packs", "pools", "identity"]) {
    await client.db(`migrate-${name}`).dropDatabase();
  }
});

/** A seeded user row with an osuId, a username and a createdAt. */
const userRow = (osuId: number, username: string, createdAt: Date) => ({
  _id: new ObjectId(),
  osuId,
  username,
  email: `${osuId}@osu.local`,
  createdAt,
});

describe("migrateIdentity (dry run, the default)", () => {
  it("merges by osuId, earliest createdAt wins, and writes nothing", async () => {
    const early = userRow(1, "player1", new Date("2026-01-01"));
    const late = userRow(1, "player1-renamed", new Date("2026-03-01"));
    await appDb("bb").collection("user").insertOne(early);
    await appDb("packs").collection("user").insertOne(late);

    const apps: MigrateAppSpec[] = [
      { id: "bb", db: appDb("bb") },
      { id: "packs", db: appDb("packs") },
    ];
    const report = await migrateIdentity(apps, identityDb);
    expect(report.dryRun).toBe(true);
    expect(report.usersSeen).toBe(2);
    expect(report.usersWritten).toBe(1);
    expect(report.idMap[`bb:${early._id.toHexString()}`]).toBe(
      report.idMap[`packs:${late._id.toHexString()}`],
    );
    expect(await identityDb.collection("user").countDocuments()).toBe(0);
  });
});

describe("migrateIdentity (--execute)", () => {
  const seed = async () => {
    const early = userRow(2, "winner", new Date("2026-01-01"));
    const late = userRow(2, "loser", new Date("2026-03-01"));
    await appDb("bb").collection("user").insertOne(early);
    await appDb("packs").collection("user").insertOne(late);

    await appDb("bb").collection("account").insertOne({
      _id: new ObjectId(),
      userId: early._id,
      providerId: "osu",
      accountId: "2",
    });
    await appDb("packs").collection("account").insertOne({
      _id: new ObjectId(),
      userId: late._id,
      providerId: "osu",
      accountId: "2",
    });

    await appDb("bb")
      .collection("session")
      .insertMany([
        { _id: new ObjectId(), userId: early._id, token: "t1" },
        { _id: new ObjectId(), userId: early._id, token: "t2" },
      ]);

    await appDb("packs").collection(API_KEYS_COLLECTION).insertOne({
      _id: new ObjectId(),
      userId: late._id,
      prefix: "hpk_abcdefgh",
      hash: "deadbeef",
      createdAt: new Date(),
    });

    await appDb("bb").collection("pack").insertOne({
      _id: new ObjectId(),
      ownerId: early._id.toHexString(),
      name: "a pack",
    });

    return { early, late };
  };

  it("writes the winning user, copies accounts deduped, drops sessions, copies keys", async () => {
    const { early, late } = await seed();
    const apps: MigrateAppSpec[] = [
      { id: "bb", db: appDb("bb") },
      { id: "packs", db: appDb("packs") },
    ];
    const report = await migrateIdentity(apps, identityDb, { dryRun: false });

    expect(report.usersWritten).toBe(1);
    const identityUser = await identityDb.collection("user").findOne({ osuId: 2 });
    expect(identityUser).toMatchObject({ username: "winner" });

    expect(report.accountsCopied).toBe(1);
    expect(await identityDb.collection("account").countDocuments()).toBe(1);

    expect(report.sessionsDropped).toBe(2);
    expect(await appDb("bb").collection("session").countDocuments()).toBe(0);

    expect(report.apiKeysCopied).toBe(1);
    const copiedKey = await identityDb.collection(API_KEYS_COLLECTION).findOne({});
    expect(copiedKey).toMatchObject({ scopes: ["*"], app: "packs" });

    expect(early._id).toBeDefined();
    expect(late._id).toBeDefined();
  });

  it("rewrites userId references per app, in that app's own collections", async () => {
    const { early } = await seed();
    const apps: MigrateAppSpec[] = [
      { id: "bb", db: appDb("bb"), references: [{ collection: "pack", field: "ownerId" }] },
      { id: "packs", db: appDb("packs") },
    ];
    const report = await migrateIdentity(apps, identityDb, { dryRun: false });

    const rewrite = report.referencesRewritten.find((r) => r.collection === "pack");
    expect(rewrite?.modified).toBe(1);
    const pack = await appDb("bb").collection("pack").findOne({});
    expect(pack?.ownerId).not.toBe(early._id.toHexString());
    expect(pack?.ownerId).toBe(report.idMap[`bb:${early._id.toHexString()}`]);
  });

  it("leaves old collections alone without --drop-old, and drops them with it", async () => {
    await seed();
    const apps: MigrateAppSpec[] = [
      { id: "bb", db: appDb("bb") },
      { id: "packs", db: appDb("packs") },
    ];
    const kept = await migrateIdentity(apps, identityDb, { dryRun: false });
    expect(kept.droppedCollections).toEqual([]);
    expect(await appDb("bb").listCollections({ name: "account" }).toArray()).toHaveLength(1);

    await appDb("bb").collection("session").insertOne({ _id: new ObjectId(), token: "fresh" });
    const dropped = await migrateIdentity(apps, identityDb, { dryRun: false, dropOld: true });
    expect(dropped.droppedCollections).toEqual(
      expect.arrayContaining([
        { app: "bb", collection: "session" },
        { app: "bb", collection: "account" },
        { app: "packs", collection: "account" },
      ]),
    );
    expect(await appDb("bb").listCollections({ name: "account" }).toArray()).toHaveLength(0);
  });

  it("tolerates a --drop-old run with nothing left to drop", async () => {
    const apps: MigrateAppSpec[] = [{ id: "bb", db: appDb("bb") }];
    const report = await migrateIdentity(apps, identityDb, { dryRun: false, dropOld: true });
    expect(report.droppedCollections).toEqual([]);
  });
});
