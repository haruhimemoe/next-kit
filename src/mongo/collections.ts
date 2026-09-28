/**
 * @file src/mongo/collections.ts
 * @desc The collection-name constants pattern both apps use (src/constants/db.ts): one frozen
 *       object naming every collection, checked once at load, so a typo or two names for one
 *       collection fails at start instead of writing somewhere nobody reads.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** MongoDB's collection name rules: no $, no NUL, not empty, not a system collection. */
const COLLECTION_NAME = /^(?!system\.)[^$\0]{1,120}$/;

/**
 * @function defineCollections
 * @param names {T} constant key to collection name, like { pools: "pools", rateLimits: "rate_limits" }
 * @returns {Readonly<T>} the same names, frozen
 * @throws {Error} naming the key whose collection name is invalid or used twice
 */
export const defineCollections = <const T extends Record<string, string>>(
  names: T,
): Readonly<T> => {
  const seen = new Map<string, string>();
  for (const [key, name] of Object.entries(names)) {
    if (!COLLECTION_NAME.test(name))
      throw new Error(`defineCollections: ${key} isn't a valid name`);
    const other = seen.get(name);
    if (other) throw new Error(`defineCollections: ${key} and ${other} both name "${name}"`);
    seen.set(name, key);
  }
  return Object.freeze({ ...names });
};
