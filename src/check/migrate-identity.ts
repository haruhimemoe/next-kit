/**
 * @file src/check/migrate-identity.ts
 * @desc The core of `next-kit migrate-identity` (identity spec section 10, plan step 8): merges
 *       each app's own `user` rows into one `identity` database by `osuId` (earliest createdAt
 *       wins), copies accounts and API keys onto the winner, rewrites `userId` references the
 *       caller lists per app, drops each app's old sessions (everyone signs in again once), and
 *       optionally drops the old per-app auth collections entirely once every app has cut over
 *       (`dropOld`: a separate drop-only run, after satellites switch to createSessionReader).
 *       Idempotent: the hub is live, so identity already holds real users who signed in there
 *       directly. When a source group's osuId matches an existing identity user, that identity
 *       user wins outright (its _id, its fields never overwritten, only its missing fields
 *       filled from the source), and nothing new is inserted for it. Accounts dedupe by
 *       providerId+accountId, API keys by hash, both against identity's own existing rows, so a
 *       second `--execute` run inserts nothing new. Dry run by default: nothing is written until
 *       `dryRun: false`, and a dry run reports the same counts the real run would. `dropOld`
 *       refuses an empty identity (nothing dropped before it's copied) and is always its own,
 *       separate run. About 3 real users across bb/packs/pools: a printed plan is enough, no UI.
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
  type MigrateAppSpec,
  type MigrateIdentityOptions,
  type MigrateReport,
  OLD_AUTH_COLLECTIONS,
  type RawUser,
  resolveWinners,
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

  const report: MigrateReport = {
    dryRun,
    dropOld,
    usersSeen: allUsers.length,
    usersWritten: 0,
    usersMerged: 0,
    accountsCopied: 0,
    sessionsDropped: 0,
    apiKeysCopied: 0,
    referencesRewritten: [],
    droppedCollections: [],
    idMap: {},
  };

  // --drop-old refuses an empty identity (dropping the old auth collections before they were
  // copied loses them), and never touches `user`/groups below, so this check alone is enough.
  if (dropOld) {
    const migrated = (await identityDb.collection("user").countDocuments({}, { limit: 1 })) > 0;
    if (!migrated) {
      throw new Error("migrate-identity --drop-old: identity has no users yet; migrate first");
    }
    for (const app of apps) {
      const existing = new Set(
        (await app.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
      );
      for (const collection of OLD_AUTH_COLLECTIONS) {
        if (!existing.has(collection)) continue;
        if (!dryRun) {
          try {
            await app.db.collection(collection).drop();
          } catch {
            // "ns not found": dropped between the listing and now. Nothing to surface.
            continue;
          }
        }
        report.droppedCollections.push({ app: app.id, collection });
      }
    }
    return report;
  }

  // The hub is live: identity may already hold real users who signed in there directly. A
  // group's osuId matching one of them wins outright (missing fields filled, nothing
  // overwritten, nothing inserted); otherwise the earliest-createdAt source user wins fresh.
  const existingUsers = await identityDb.collection<RawUser>("user").find().toArray();
  const { idMap, winners } = resolveWinners(groups, existingUsers);
  report.idMap = idMap;
  report.usersWritten = winners.filter((w) => w.isNew).length;
  report.usersMerged = winners.length - report.usersWritten;

  if (!dryRun) {
    const toInsert = winners.filter((w) => w.isNew).map((w) => w.insertDoc as RawUser);
    if (toInsert.length > 0) await identityDb.collection("user").insertMany(toInsert);
    for (const winner of winners) {
      if (winner.isNew || !winner.missing || Object.keys(winner.missing).length === 0) continue;
      await identityDb
        .collection("user")
        .updateOne({ _id: winner.identityId }, { $set: winner.missing });
    }
  }

  // Copy accounts onto the winner, deduped by providerId+accountId against identity's own rows
  // too, so a rerun copies nothing twice.
  report.accountsCopied = await copyByUserId(
    apps,
    identityDb,
    idMap,
    "account",
    () => ({}),
    (doc) => `${doc.providerId}:${doc.accountId}`,
    !dryRun,
  );

  // Rewrite each app's own userId references, stored either as a hex string or an ObjectId;
  // each keeps its own type.
  for (const app of apps) {
    for (const { collection, field } of app.references ?? []) {
      let modified = 0;
      for (const user of allUsers.filter((candidate) => candidate.app === app.id)) {
        const oldId = user.doc._id;
        const newId = idMap[`${app.id}:${oldId.toHexString()}`];
        if (!newId || newId === oldId.toHexString()) continue;
        const target = app.db.collection(collection);
        if (dryRun) {
          modified += await target.countDocuments({
            [field]: { $in: [oldId.toHexString(), oldId] },
          });
          continue;
        }
        const asString = await target.updateMany(
          { [field]: oldId.toHexString() },
          { $set: { [field]: newId } },
        );
        const asObjectId = await target.updateMany(
          { [field]: oldId },
          { $set: { [field]: new ObjectId(newId) } },
        );
        modified += asString.modifiedCount + asObjectId.modifiedCount;
      }
      report.referencesRewritten.push({ app: app.id, collection, field, modified });
    }
  }

  // Drop old sessions: everyone signs in again once, under the shared identity session.
  for (const app of apps) {
    const sessions = app.db.collection("session");
    report.sessionsDropped += dryRun
      ? await sessions.countDocuments()
      : (await sessions.deleteMany({})).deletedCount;
  }

  // Copy API keys onto the winner, deduped by hash, scopes: ["*"] (0.13 splits real scopes per
  // app).
  report.apiKeysCopied = await copyByUserId(
    apps,
    identityDb,
    idMap,
    API_KEYS_COLLECTION,
    (app) => ({
      app: app.id,
      scopes: ["*"],
    }),
    (doc) => String(doc.hash),
    !dryRun,
  );

  return report;
};
