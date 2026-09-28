/**
 * @file src/mongo/index.ts
 * @desc @haruhimemoe/next-kit/mongo: the connect-once MongoDB client with Mongoose on the same
 *       client, index declaration and duplicate-safe creation, the collection-name constants
 *       pattern, and the duplicate key check. Server only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export {
  createMongo,
  DEFAULT_MAX_POOL_SIZE,
  DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  type Mongo,
  type MongoOptions,
} from "./client.js";
export { defineCollections } from "./collections.js";
export { DUPLICATE_KEY, isDuplicateKeyError } from "./duplicate.js";
export {
  ensureIndexes,
  type IndexReport,
  type IndexSpec,
  indexName,
  ttlIndex,
} from "./indexes.js";
