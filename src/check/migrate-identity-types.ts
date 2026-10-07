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
 * merging, winning identity rows written, winners that matched an existing identity user
 * instead (merged into it, filling only its missing fields), accounts/keys copied, sessions
 * dropped, references rewritten, old collections dropped, and the full old-id-to-winner idMap
 * (`"<appId>:<hex>"` -> the winning identity user id, hex — the existing identity user's id when
 * merged, otherwise a freshly minted one). */
export type MigrateReport = {
  dryRun: boolean;
  dropOld: boolean;
  usersSeen: number;
  usersWritten: number;
  usersMerged: number;
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

/** One osuId group's resolution: the winning identity id, whether it's a fresh insert or an
 * existing identity user to merge into, and (when merging) the fields missing from it. */
export type ResolvedWinner = {
  identityId: ObjectId;
  isNew: boolean;
  insertDoc?: RawUser;
  missing?: Record<string, unknown>;
};

/**
 * @function resolveWinners
 * @param groups {Map<number, AppUser[]>} source users grouped by osuId
 * @param existingUsers {readonly RawUser[]} identity's own users, read before merging
 * @returns {{ idMap: Record<string, string>; winners: ResolvedWinner[] }} every source user id
 *   mapped to its winning identity id, and one resolution per group: an existing identity user
 *   with that osuId wins outright (its missing fields only, never overwriting what it has);
 *   otherwise the earliest-createdAt source user wins as a fresh insert
 */
export const resolveWinners = (
  groups: Map<number, AppUser[]>,
  existingUsers: readonly RawUser[],
): { idMap: Record<string, string>; winners: ResolvedWinner[] } => {
  const existingByOsuId = new Map<number, RawUser>();
  for (const user of existingUsers) existingByOsuId.set(user.osuId, user);

  const idMap: Record<string, string> = {};
  const winners: ResolvedWinner[] = [];
  for (const group of groups.values()) {
    const sourceWinner = group.reduce(earliest);
    const existing = existingByOsuId.get(sourceWinner.doc.osuId);
    const identityId = existing ? existing._id : new ObjectId();
    for (const user of group)
      idMap[`${user.app}:${user.doc._id.toHexString()}`] = identityId.toHexString();

    if (existing) {
      const missing: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(sourceWinner.doc)) {
        if (key === "_id" || existing[key] !== undefined) continue;
        missing[key] = value;
      }
      winners.push({ identityId, isNew: false, missing });
    } else {
      winners.push({
        identityId,
        isNew: true,
        insertDoc: { ...sourceWinner.doc, _id: identityId },
      });
    }
  }
  return { idMap, winners };
};

/**
 * @function copyByUserId
 * @param apps {readonly MigrateAppSpec[]} the apps to read `collection` from
 * @param identityDb {Db} where copies land
 * @param idMap {Record<string, string>} old `"<appId>:<hex>"` to the winning identity user id
 * @param collection {string} the collection name, same in every app and in identity
 * @param extra {(app: MigrateAppSpec) => Document} extra fields merged into each copy
 * @param dedupe {((doc: Document) => string) | undefined} a key that skips a repeat; also used
 *   to seed `seen` from identity's own existing rows, so a rerun copies nothing twice
 * @param write {boolean} false counts what would be copied without inserting (dry run)
 * @returns {Promise<number>} how many rows were (or would be) newly copied
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
  if (dedupe) {
    const existing = await identityDb.collection<Document>(collection).find().toArray();
    for (const doc of existing) seen.add(dedupe(doc));
  }
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
