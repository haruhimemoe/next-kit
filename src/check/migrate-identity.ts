/**
 * @file src/check/migrate-identity.ts
 * @desc The core of `next-kit migrate-identity` (identity spec section 10, plan step 8): merges
 *       each app's own `user` rows into one `identity` database by `osuId` (earliest createdAt
 *       wins), copies accounts and API keys onto the winner, rewrites `userId` references the
 *       caller lists per app, drops each app's old sessions (everyone signs in again once), and
 *       optionally drops the old per-app auth collections entirely once every app has cut over
 *       (`dropOld`, run separately after satellites switch to createSessionReader). Dry run by
 *       default: nothing is written until the caller passes `dryRun: false`, and the report is
 *       the same shape either way, so a dry run previews exactly what would happen. With about
 *       3 real users across bb/packs/pools, a printed plan is enough; there's no UI.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { Db, Document } from "mongodb";
import { ObjectId } from "mongodb";
import { API_KEYS_COLLECTION } from "../api-keys/store.js";

/** The old per-app collections migrate-identity deletes from (sessions, always) or drops
 * entirely (--drop-old, after cutover). */
export const OLD_AUTH_COLLECTIONS = Object.freeze(["session", "account", "verification"]);

/** A userId reference to rewrite in one of an app's own collections. */
export type UserIdReference = { collection: string; field: string };

/** One app migrate-identity reads from. */
export type MigrateAppSpec = {
  /** The app's id, like "bb", "packs" or "pools" (also the fan-out app id later). */
  id: string;
  /** The app's own database (not identity). */
  db: Db;
  /** userId references to rewrite in this app's own collections, as `{ collection, field }`
   * (the app lists its own: migrate-identity never guesses). */
  references?: readonly UserIdReference[];
};

/** migrateIdentity's options. */
export type MigrateIdentityOptions = {
  /** Preview only; nothing is written (default true). */
  dryRun?: boolean;
  /** Also drop each app's old session, account and verification collections entirely, after
   * every app has cut over to createSessionReader (default false; independent of dryRun: a
   * dry run with dropOld still only reports what would be dropped). */
  dropOld?: boolean;
};

/** One userId reference rewrite's result. */
export type ReferenceRewrite = { app: string; collection: string; field: string; modified: number };

/** One old collection migrate-identity dropped (or would drop with --drop-old). */
export type DroppedCollection = { app: string; collection: string };

/** What migrateIdentity did, or would do on a dry run. */
export type MigrateReport = {
  dryRun: boolean;
  dropOld: boolean;
  /** Every user row seen across every app, before merging. */
  usersSeen: number;
  /** Winning identity user rows written (or that would be written). */
  usersWritten: number;
  accountsCopied: number;
  sessionsDropped: number;
  apiKeysCopied: number;
  referencesRewritten: ReferenceRewrite[];
  droppedCollections: DroppedCollection[];
  /** Every old user id, as `"<appId>:<hex>"`, to the winning identity user id (hex). */
  idMap: Record<string, string>;
};

type RawUser = Document & { _id: ObjectId; osuId: number; createdAt?: Date };

type AppUser = { app: string; doc: RawUser };

const earliest = (a: AppUser, b: AppUser): AppUser => {
  const atA = a.doc.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const atB = b.doc.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return atA <= atB ? a : b;
};

/**
 * @function migrateIdentity
 * @param apps {readonly MigrateAppSpec[]} the apps to merge, each with its own database and
 *        userId references
 * @param identityDb {Db} the hub's identity database (the migration's target)
 * @param options {MigrateIdentityOptions} dryRun (default true) and dropOld (default false)
 * @returns {Promise<MigrateReport>} what happened, or would happen on a dry run
 */
export const migrateIdentity = async (
  apps: readonly MigrateAppSpec[],
  identityDb: Db,
  { dryRun = true, dropOld = false }: MigrateIdentityOptions = {},
): Promise<MigrateReport> => {
  // 1. Collect every user row across every app.
  const allUsers: AppUser[] = [];
  for (const app of apps) {
    const docs = await app.db.collection<RawUser>("user").find().toArray();
    for (const doc of docs) allUsers.push({ app: app.id, doc });
  }

  // 2. Group by osuId, earliest createdAt wins (undated rows lose to any dated one).
  const groups = new Map<number, AppUser[]>();
  for (const user of allUsers) {
    const group = groups.get(user.doc.osuId);
    if (group) group.push(user);
    else groups.set(user.doc.osuId, [user]);
  }

  const idMap: Record<string, string> = {};
  const winners: { identityId: ObjectId; winner: AppUser; group: AppUser[] }[] = [];
  for (const group of groups.values()) {
    const winner = group.reduce(earliest);
    const identityId = new ObjectId();
    for (const user of group) idMap[`${user.app}:${user.doc._id.toHexString()}`] = identityId.toHexString();
    winners.push({ identityId, winner, group });
  }

  const report: MigrateReport = {
    dryRun,
    dropOld,
    usersSeen: allUsers.length,
    usersWritten: winners.length,
    accountsCopied: 0,
    sessionsDropped: 0,
    apiKeysCopied: 0,
    referencesRewritten: [],
    droppedCollections: [],
    idMap,
  };

  if (dryRun) return report;

  // 3. Write the winning identity user rows.
  if (winners.length > 0) {
    await identityDb.collection("user").insertMany(
      winners.map(({ identityId, winner }) => {
        const { _id, ...fields } = winner.doc;
        return { _id: identityId, ...fields };
      }),
    );
  }

  // 4. Copy accounts onto the winner, deduped by providerId+accountId.
  const seenAccounts = new Set<string>();
  for (const app of apps) {
    const accounts = await app.db.collection<Document>("account").find().toArray();
    for (const account of accounts) {
      const oldUserId = String(account.userId);
      const newUserId = idMap[`${app.id}:${oldUserId}`];
      if (!newUserId) continue;
      const key = `${account.providerId}:${account.accountId}`;
      if (seenAccounts.has(key)) continue;
      seenAccounts.add(key);
      const { _id, userId, ...fields } = account;
      await identityDb
        .collection("account")
        .insertOne({ ...fields, userId: new ObjectId(newUserId) });
      report.accountsCopied += 1;
    }
  }

  // 5. Rewrite each app's own userId references.
  for (const app of apps) {
    for (const { collection, field } of app.references ?? []) {
      let modified = 0;
      for (const user of allUsers.filter((candidate) => candidate.app === app.id)) {
        const newId = idMap[`${app.id}:${user.doc._id.toHexString()}`];
        if (!newId || newId === user.doc._id.toHexString()) continue;
        const result = await app.db
          .collection(collection)
          .updateMany({ [field]: user.doc._id.toHexString() }, { $set: { [field]: newId } });
        modified += result.modifiedCount;
      }
      report.referencesRewritten.push({ app: app.id, collection, field, modified });
    }
  }

  // 6. Drop old sessions: everyone signs in again once, under the shared identity session.
  for (const app of apps) {
    const { deletedCount } = await app.db.collection("session").deleteMany({});
    report.sessionsDropped += deletedCount;
  }

  // 7. Copy API keys onto the winner, scopes: ["*"] (0.13 splits real scopes per app).
  for (const app of apps) {
    const keys = await app.db.collection<Document>(API_KEYS_COLLECTION).find().toArray();
    for (const key of keys) {
      const newUserId = idMap[`${app.id}:${String(key.userId)}`];
      if (!newUserId) continue;
      const { _id, userId, ...fields } = key;
      await identityDb.collection(API_KEYS_COLLECTION).insertOne({
        ...fields,
        userId: new ObjectId(newUserId),
        app: app.id,
        scopes: ["*"],
      });
      report.apiKeysCopied += 1;
    }
  }

  // 8. --drop-old: once every app has cut over, the old per-app auth collections are dead
  // weight. Tolerates a collection that doesn't exist (already dropped, or never existed).
  if (dropOld) {
    for (const app of apps) {
      const existing = new Set(
        (await app.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
      );
      for (const collection of OLD_AUTH_COLLECTIONS) {
        if (!existing.has(collection)) continue;
        try {
          await app.db.collection(collection).drop();
          report.droppedCollections.push({ app: app.id, collection });
        } catch {
          // "ns not found": nothing to drop. Not an error worth surfacing.
        }
      }
    }
  }

  return report;
};
