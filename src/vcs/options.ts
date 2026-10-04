/**
 * @file src/vcs/options.ts
 * @desc Checks createRevisionStore's options and fills in the defaults. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { type Codec, defineCodec } from "@haruhimemoe/vcs";
import type { RevisionStoreOptions } from "./types.js";

/** Revisions kept per document before the oldest autosaves go. */
export const DEFAULT_MAX_REVISIONS = 1000;
/** Largest value, in bytes of canonical JSON. */
export const DEFAULT_MAX_BYTES = 1_000_000;
/** How many times commit retries when another writer takes its seq. */
export const COMMIT_ATTEMPTS = 3;

/** Options with every default filled in. */
export type ResolvedOptions<T> = Required<Omit<RevisionStoreOptions<T>, "check">> & {
  check: NonNullable<RevisionStoreOptions<T>["check"]> | null;
  codec: Codec;
};

const positiveInt = (name: string, value: number): number => {
  if (!Number.isInteger(value) || value < 1)
    throw new TypeError(`createRevisionStore: ${name} must be a positive integer`);
  return value;
};

/**
 * @function resolveOptions
 * @param options {RevisionStoreOptions<T>} the caller's options
 * @returns {ResolvedOptions<T>} the same with defaults
 * @throws {TypeError} for an empty collection name or a non-positive limit
 */
export const resolveOptions = <T>(options: RevisionStoreOptions<T>): ResolvedOptions<T> => {
  if (!options.collection) throw new TypeError("createRevisionStore: collection is required");
  return {
    db: options.db,
    collection: options.collection,
    codec: options.codec ?? defineCodec({}),
    check: options.check ?? null,
    maxRevisions: positiveInt("maxRevisions", options.maxRevisions ?? DEFAULT_MAX_REVISIONS),
    maxBytes: positiveInt("maxBytes", options.maxBytes ?? DEFAULT_MAX_BYTES),
    now: options.now ?? Date.now,
  };
};
