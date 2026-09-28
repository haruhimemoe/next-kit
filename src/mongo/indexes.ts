/**
 * @file src/mongo/indexes.ts
 * @desc Index declaration and creation for collections Mongoose doesn't manage. Each index builds
 *       on its own over whatever data is there: a unique one that existing duplicates break is
 *       skipped and logged with up to 10 of the duplicate keys (never for a secret key, like a
 *       session token), any other failure is logged, and the rest still build. Nothing throws:
 *       a missing index must not take sign-in or the site down. createIndex is a no-op when the
 *       index already exists. Moved from pools (src/lib/db-indexes.ts), whose auth indexes got
 *       this treatment; the TTL indexes both apps declared use it too.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Db, Document } from "mongodb";
import { isDuplicateKeyError } from "./duplicate.js";

/** One index to build. */
export type IndexSpec = {
  collection: string;
  /** Field order matters; 1 ascending, -1 descending. */
  key: Record<string, 1 | -1>;
  /** Defaults to MongoDB's own (`field_1_other_-1`). */
  name?: string;
  unique?: boolean;
  /** A TTL index: documents go this long after the key's date (0: at it). */
  expireAfterSeconds?: number;
  partialFilterExpression?: Document;
  /** The key is a credential: never log its values. */
  secret?: boolean;
};

/** What ensureIndexes did, by index name. */
export type IndexReport = { built: string[]; skipped: string[] };

/**
 * @function indexName
 * @param spec {IndexSpec} an index
 * @returns {string} its name, or the one MongoDB gives it (`osuId_1`, `a_1_b_-1`)
 */
export const indexName = (spec: IndexSpec): string =>
  spec.name ??
  Object.entries(spec.key)
    .map(([field, order]) => `${field}_${order}`)
    .join("_");

/**
 * @function ttlIndex
 * @param collection {string} the collection
 * @param field {string} the date field
 * @param expireAfterSeconds {number} how long after that date a document goes (default 0)
 * @param name {string | undefined} the index name (default MongoDB's)
 * @returns {IndexSpec} a TTL index on that field
 */
export const ttlIndex = (
  collection: string,
  field: string,
  expireAfterSeconds = 0,
  name?: string,
): IndexSpec => ({
  collection,
  key: { [field]: 1 },
  expireAfterSeconds,
  ...(name === undefined ? {} : { name }),
});

/** Up to 10 key values held by more than one row, with how many rows hold each. */
const duplicatesOf = async (db: Db, spec: IndexSpec): Promise<unknown[]> => {
  const group = Object.fromEntries(Object.keys(spec.key).map((field) => [field, `$${field}`]));
  return db
    .collection(spec.collection)
    .aggregate([
      { $group: { _id: group, rows: { $sum: 1 } } },
      { $match: { rows: { $gt: 1 } } },
      { $limit: 10 },
    ])
    .toArray();
};

const buildIndex = async (db: Db, spec: IndexSpec): Promise<boolean> => {
  const name = indexName(spec);
  const { collection, key, secret, ...options } = spec;
  try {
    await db.collection(collection).createIndex(key, { ...options, name });
    return true;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      console.error(`db: couldn't create ${name}`, secret ? "" : error);
      return false;
    }
    const found = secret ? [] : await duplicatesOf(db, spec).catch(() => []);
    console.error(
      `db: ${collection} has rows sharing ${Object.keys(key).join(", ")}, so ${name} wasn't built. ` +
        "Merge or remove the extra rows; it builds on the next start.",
      secret ? "" : JSON.stringify(found),
    );
    return false;
  }
};

/**
 * @function ensureIndexes
 * @param db {Db} the database
 * @param specs {readonly IndexSpec[]} the indexes to build
 * @returns {Promise<IndexReport>} each index built, or skipped and logged (never thrown)
 */
export const ensureIndexes = async (db: Db, specs: readonly IndexSpec[]): Promise<IndexReport> => {
  const results = await Promise.all(specs.map((spec) => buildIndex(db, spec)));
  const report: IndexReport = { built: [], skipped: [] };
  specs.forEach((spec, index) => {
    report[results[index] ? "built" : "skipped"].push(indexName(spec));
  });
  return report;
};
