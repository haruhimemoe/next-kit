/**
 * @file src/vcs/docs.ts
 * @desc The stored form of a revision (createdAt as a Date, _id as the id), the conversions to
 *       and from it, and the indexes the store needs. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import type { Revision, RevisionMeta } from "@haruhimemoe/vcs";
import type { IndexSpec } from "../mongo/indexes.js";

/** A revision as MongoDB holds it. */
export type RevisionDoc<T> = Omit<Revision<T>, "id" | "createdAt"> & {
  _id: string;
  createdAt: Date;
};

/** Every field but the value, for history lists. */
export const META_PROJECTION = { value: 0 } as const;

/**
 * @function toMeta
 * @param doc {Omit<RevisionDoc<unknown>, "value">} a stored revision without its value
 * @returns {RevisionMeta} the public metadata, field by field (stray stored fields stay out)
 */
export const toMeta = (doc: Omit<RevisionDoc<unknown>, "value">): RevisionMeta => ({
  id: doc._id,
  docId: doc.docId,
  seq: doc.seq,
  kind: doc.kind,
  valueHash: doc.valueHash,
  authorId: doc.authorId,
  authorName: doc.authorName,
  message: doc.message,
  createdAt: doc.createdAt.toISOString(),
  ...(doc.base === undefined ? {} : { base: doc.base }),
  ...(doc.forkOf === undefined ? {} : { forkOf: doc.forkOf }),
  ...(doc.upstream === undefined ? {} : { upstream: doc.upstream }),
});

/**
 * @function toRevision
 * @param doc {RevisionDoc<T>} a stored revision
 * @returns {Revision<T>} the public shape (id, ISO createdAt) with its value
 */
export const toRevision = <T>(doc: RevisionDoc<T>): Revision<T> => ({
  ...toMeta(doc),
  value: doc.value,
});

/**
 * @function revisionIndexSpecs
 * @param collection {string} the revisions collection
 * @returns {IndexSpec[]} unique (docId, seq) (history order, and what catches two writers),
 *          authorId (renames), and (docId, kind, createdAt) (autosave pruning)
 */
export const revisionIndexSpecs = (collection: string): IndexSpec[] => [
  { collection, key: { docId: 1, seq: -1 }, unique: true },
  { collection, key: { authorId: 1 } },
  { collection, key: { docId: 1, kind: 1, createdAt: 1 } },
];
