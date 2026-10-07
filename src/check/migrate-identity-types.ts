/**
 * @file src/check/migrate-identity-types.ts
 * @desc Types for migrateIdentity (migrate-identity.ts), split out so that file stays under the
 *       200-line house limit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { type Db, type Document, ObjectId } from "mongodb";

/** The old per-app collections migrate-identity deletes from (sessions, always) or drops
 * entirely (--drop-old, after cutover). */
export const OLD_AUTH_COLLECTIONS = Object.freeze(["session", "account", "verification"]);

/** A userId reference to rewrite in one of an app's own collections. */
export type UserIdReference = { collection: string; field: string };

/** One app migrate-identity reads from: its id (also the fan-out app id later), its own
 * database (not identity), and the userId references to rewrite in its own collections (the
 * app lists its own; migrate-identity never guesses). */
export type MigrateAppSpec = {
  id: string;
  db: Db;
  references?: readonly UserIdReference[];
};

/** migrateIdentity's options: dryRun previews only (default true); dropOld is a separate,
 * drop-only run that drops each app's old session/account/verification collections entirely,
 * meant for after every app has cut over to createSessionReader (default false). A dropOld run
 * never merges, and refuses unless identity already holds migrated users. */
export type MigrateIdentityOptions = { dryRun?: boolean; dropOld?: boolean };

/** One userId reference rewrite's result. */
export type ReferenceRewrite = { app: string; collection: string; field: string; modified: number };

/** One old collection migrate-identity dropped (or would drop with --drop-old). */
export type DroppedCollection = { app: string; collection: string };

/** What migrateIdentity did, or would do on a dry run: users seen across every app before
 * merging, winning identity rows written, accounts/keys copied, sessions dropped, references
 * rewritten, old collections dropped, and the full old-id-to-winner idMap
 * (`"<appId>:<hex>"` -> the winning identity user id, hex). */
export type MigrateReport = {
  dryRun: boolean;
  dropOld: boolean;
  usersSeen: number;
  usersWritten: number;
  accountsCopied: number;
  sessionsDropped: number;
  apiKeysCopied: number;
  referencesRewritten: ReferenceRewrite[];
  droppedCollections: DroppedCollection[];
  idMap: Record<string, string>;
};

/** A raw app `user` row, as migrateIdentity reads it. */
export type RawUser = Document & { _id: ObjectId; osuId: number; createdAt?: Date };

/** One user row tagged with the app it came from. */
export type AppUser = { app: string; doc: RawUser };

/**
 * @function earliest
 * @param a {AppUser} one user row
 * @param b {AppUser} another, same osuId
 * @returns {AppUser} whichever has the earlier createdAt (undated loses to any dated row)
 */
export const earliest = (a: AppUser, b: AppUser): AppUser => {
  const atA = a.doc.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const atB = b.doc.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return atA <= atB ? a : b;
};

/**
 * @function copyByUserId
 * @param apps {readonly MigrateAppSpec[]} the apps to read `collection` from
 * @param identityDb {Db} where copies land
 * @param idMap {Record<string, string>} old `"<appId>:<hex>"` to the winning identity user id
 * @param collection {string} the collection name, same in every app and in identity
 * @param extra {(app: MigrateAppSpec) => Document} extra fields merged into each copy
 * @param dedupe {((doc: Document) => string) | undefined} a key that skips a repeat
 * @param write {boolean} false counts what would be copied without inserting (dry run)
 * @returns {Promise<number>} how many rows were (or would be) copied
 */
export const copyByUserId = async (
  apps: readonly MigrateAppSpec[],
  identityDb: Db,
  idMap: Record<string, string>,
  collection: string,
  extra: (app: MigrateAppSpec) => Document,
  dedupe?: (doc: Document) => string,
  write = true,
): Promise<number> => {
  const seen = new Set<string>();
  let copied = 0;
  for (const app of apps) {
    const docs = await app.db.collection<Document>(collection).find().toArray();
    for (const doc of docs) {
      const newUserId = idMap[`${app.id}:${String(doc.userId)}`];
      if (!newUserId) continue;
      const key = dedupe?.(doc);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      const { _id, userId, ...fields } = doc;
      if (write)
        await identityDb
          .collection(collection)
          .insertOne({ ...fields, ...extra(app), userId: new ObjectId(newUserId) });
      copied += 1;
    }
  }
  return copied;
};
