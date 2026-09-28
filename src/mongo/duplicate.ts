/**
 * @file src/mongo/duplicate.ts
 * @desc Whether a MongoDB error is a duplicate key (E11000): two upserts racing to insert the
 *       same _id, or a unique index that existing rows break. Pure, no driver import.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** MongoDB's duplicate key error code. */
export const DUPLICATE_KEY = 11000;

/**
 * @function isDuplicateKeyError
 * @param error {unknown} anything thrown
 * @returns {boolean} true when it carries code 11000
 */
export const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === DUPLICATE_KEY;
