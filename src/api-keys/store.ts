/**
 * @file src/api-keys/store.ts
 * @desc One API key per user in MongoDB (collection api_keys): issue (replaces), info, revoke,
 *       authenticate and account deletion. Only the SHA-256 hash and a display prefix are
 *       stored. Two issues racing still leave one key (unique userId; the loser updates).
 *       authenticate gives the owner's user id; who that user is stays the app's call.
 *       lastUsedAt is written at most once an hour. Moved from packs (src/services/api-keys.ts).
 *       0.13: each key carries scopes (default ["*"]; a doc without the field reads as ["*"]).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Tue Oct 6, 2026
 */

import { type Db, ObjectId } from "mongodb";
import { isDuplicateKeyError } from "../mongo/duplicate.js";
import { ensureIndexes as buildIndexes, type IndexSpec } from "../mongo/indexes.js";
import {
  apiKeyDisplay,
  assertApiKeyPrefix,
  generateApiKey,
  hashApiKey,
  isApiKeyFormat,
} from "./format.js";
import { normalizeScopes } from "./scopes.js";

/** The collection every app keeps its keys in. */
export const API_KEYS_COLLECTION = "api_keys";
/** lastUsedAt is written at most this often, to save writes. */
export const LAST_USED_INTERVAL_MS = 60 * 60 * 1000;

/** A key as account pages show it. */
export type ApiKeyInfo = {
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  scopes: string[];
};
/** A freshly issued key: the full key, shown once, and its info. */
export type ApiKeyCreated = { key: string; apiKey: ApiKeyInfo };
/** A key that matched: its owner, and stamp() to record the use once the owner checks out. */
export type ApiKeyMatch = { userId: string; stamp: () => Promise<void>; scopes: string[] };

/** createApiKeyStore's options. */
export type ApiKeyStoreOptions = {
  prefix: string;
  db: () => Promise<Db>;
  collection?: string;
  now?: () => number;
  /** The app's declared scope list; issue refuses any other name. */
  scopes?: readonly string[];
};

/** What createApiKeyStore returns. */
export type ApiKeyStore = {
  prefix: string;
  issue: (userId: string, scopes?: readonly string[]) => Promise<ApiKeyCreated>;
  info: (userId: string) => Promise<ApiKeyInfo | null>;
  revoke: (userId: string) => Promise<boolean>;
  authenticate: (key: string) => Promise<ApiKeyMatch | null>;
  deleteFor: (userId: string) => Promise<number>;
  ensureIndexes: () => Promise<void>;
};

type ApiKeyDoc = {
  _id: ObjectId;
  userId: ObjectId;
  prefix: string;
  hash: string;
  createdAt: Date;
  lastUsedAt?: Date;
  scopes?: string[];
};

const toInfo = (doc: ApiKeyDoc): ApiKeyInfo => ({
  prefix: doc.prefix,
  createdAt: doc.createdAt.toISOString(),
  lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
  scopes: normalizeScopes(doc.scopes),
});

/**
 * @function apiKeyIndexSpecs
 * @param collection {string} the keys collection (default api_keys)
 * @returns {IndexSpec[]} unique userId and unique hash, for the app's own index list
 */
export const apiKeyIndexSpecs = (collection: string = API_KEYS_COLLECTION): IndexSpec[] => [
  { collection, key: { userId: 1 }, unique: true },
  // The hash is a credential digest: never log its values.
  { collection, key: { hash: 1 }, unique: true, secret: true },
];

/**
 * @function createApiKeyStore
 * @param options {ApiKeyStoreOptions} the app prefix, the database, the collection (default
 *        api_keys), a clock (default Date.now) and the declared scopes
 * @returns {ApiKeyStore} the key operations for that app
 * @throws {TypeError} on a bad prefix or a bad declared scope
 */
export const createApiKeyStore = ({
  prefix,
  db,
  collection = API_KEYS_COLLECTION,
  // Read per call, so fake timers in app tests move it.
  now = () => Date.now(),
  scopes: declared,
}: ApiKeyStoreOptions): ApiKeyStore => {
  assertApiKeyPrefix(prefix);
  if (declared) normalizeScopes(declared);
  const keys = async () => (await db()).collection<ApiKeyDoc>(collection);

  const issue = async (userId: string, scopes?: readonly string[]): Promise<ApiKeyCreated> => {
    const granted = normalizeScopes(scopes, declared);
    const key = generateApiKey(prefix);
    const filter = { userId: new ObjectId(userId) };
    const update = {
      $set: {
        prefix: apiKeyDisplay(key),
        hash: hashApiKey(key),
        createdAt: new Date(now()),
        scopes: granted,
      },
      $unset: { lastUsedAt: 1 as const },
    };
    const upsert = async () =>
      (await keys()).findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" });
    const doc = await upsert().catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) throw error;
      return upsert();
    });
    if (!doc) throw new Error("api key upsert returned no document");
    return { key, apiKey: toInfo(doc) };
  };

  const authenticate = async (key: string): Promise<ApiKeyMatch | null> => {
    if (!isApiKeyFormat(prefix, key)) return null;
    const hash = hashApiKey(key);
    const collectionRef = await keys();
    const doc = await collectionRef.findOne({ hash });
    if (!doc) return null;
    const stamp = async () => {
      const at = now();
      if (doc.lastUsedAt && at - doc.lastUsedAt.getTime() < LAST_USED_INTERVAL_MS) return;
      // Filter on the hash too, so a regenerate in between isn't stamped with this use.
      await collectionRef.updateOne({ _id: doc._id, hash }, { $set: { lastUsedAt: new Date(at) } });
    };
    return { userId: doc.userId.toString(), stamp, scopes: normalizeScopes(doc.scopes) };
  };

  return {
    prefix,
    issue,
    authenticate,
    info: async (userId) => {
      const doc = await (await keys()).findOne({ userId: new ObjectId(userId) });
      return doc ? toInfo(doc) : null;
    },
    revoke: async (userId) =>
      (await (await keys()).deleteOne({ userId: new ObjectId(userId) })).deletedCount === 1,
    deleteFor: async (userId) =>
      (await (await keys()).deleteMany({ userId: new ObjectId(userId) })).deletedCount,
    ensureIndexes: async () => {
      await buildIndexes(await db(), apiKeyIndexSpecs(collection));
    },
  };
};
