/**
 * @file src/check/migrate-identity.ts
 * @desc The core of `next-kit migrate-identity` (identity spec section 10, plan step 8): merges
 *       each app's own `user` rows into one `identity` database by `osuId` (earliest createdAt
 *       wins), copies accounts and API keys onto the winner, rewrites `userId` references the
 *       caller lists per app, drops each app's old sessions (everyone signs in again once), and
 *       optionally drops the old per-app auth collections entirely once every app has cut over
 *       (`dropOld`, separately, after satellites switch to createSessionReader). Dry run by
 *       default: nothing is written until `dryRun: false`, and the report is the same shape
 *       either way, so a dry run previews exactly what would happen. About 3 real users across
 *       bb/packs/pools: a printed plan is enough, no UI.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { API_KEYS_COLLECTION } from "../api-keys/store.js";
import {
  type AppUser,
  copyByUserId,
  earliest,
  type MigrateAppSpec,
  type MigrateIdentityOptions,
  type MigrateReport,
  OLD_AUTH_COLLECTIONS,
  type RawUser,
} from "./migrate-identity-types.js";

export {
  type DroppedCollection,
  type MigrateAppSpec,
  type MigrateIdentityOptions,
  type MigrateReport,
  OLD_AUTH_COLLECTIONS,
  type ReferenceRewrite,
  type UserIdReference,
} from "./migrate-identity-types.js";

/**
 * @function migrateIdentity
 * @param apps {readonly MigrateAppSpec[]} the apps to merge
 * @param identityDb {Db} the hub's identity database (the migration's target)
 * @param options {MigrateIdentityOptions} dryRun (default true), dropOld (default false)
 * @returns {Promise<MigrateReport>} what happened, or would happen on a dry run
 */
export const migrateIdentity = async (
  apps: readonly MigrateAppSpec[],
  identityDb: Db,
  { dryRun = true, dropOld = false }: MigrateIdentityOptions = {},
): Promise<MigrateReport> => {
  // Collect every user row, then group by osuId (earliest createdAt wins).
  const allUsers: AppUser[] = [];
  for (const app of apps) {
    const docs = await app.db.collection<RawUser>("user").find().toArray();
    for (const doc of docs) allUsers.push({ app: app.id, doc });
  }
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

  // Write the winning identity user rows.
  if (winners.length > 0) {
    const rows = winners.map(({ identityId, winner }) => {
      const { _id, ...fields } = winner.doc;
      return { _id: identityId, ...fields };
    });
    await identityDb.collection("user").insertMany(rows);
  }

  // Copy accounts onto the winner, deduped by providerId+accountId.
  report.accountsCopied = await copyByUserId(
    apps,
    identityDb,
    idMap,
    "account",
    () => ({}),
    (doc) => `${doc.providerId}:${doc.accountId}`,
  );

  // Rewrite each app's own userId references.
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

  // Drop old sessions: everyone signs in again once, under the shared identity session.
  for (const app of apps) {
    const { deletedCount } = await app.db.collection("session").deleteMany({});
    report.sessionsDropped += deletedCount;
  }

  // Copy API keys onto the winner, scopes: ["*"] (0.13 splits real scopes per app).
  report.apiKeysCopied = await copyByUserId(apps, identityDb, idMap, API_KEYS_COLLECTION, (app) => ({
    app: app.id,
    scopes: ["*"],
  }));

  // --drop-old, once every app has cut over: the old per-app auth collections are dead weight.
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
