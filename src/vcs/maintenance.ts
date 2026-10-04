/**
 * @file src/vcs/maintenance.ts
 * @desc diff between two revisions, author renames, deleting a document's history and pruning
 *       old autosaves. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { type Change, diffValue } from "@haruhimemoe/vcs";
import { readOne, type StoreContext } from "./read.js";

/** The changes from one revision to another, or null if either is gone. */
export const diffRevisions = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  fromId: string,
  toId: string,
): Promise<Change[] | null> => {
  const [from, to] = await Promise.all([readOne(ctx, docId, fromId), readOne(ctx, docId, toId)]);
  return from && to ? diffValue(from.value, to.value, ctx.options.codec) : null;
};

/** Rewrites authorName on every revision by this author. */
export const renameAuthor = async <T>(
  ctx: StoreContext<T>,
  authorId: string,
  name: string,
): Promise<number> =>
  (await (await ctx.collection()).updateMany({ authorId }, { $set: { authorName: name } }))
    .modifiedCount;

/** Deletes every revision of a document. */
export const removeHistory = async <T>(ctx: StoreContext<T>, docId: string): Promise<number> =>
  (await (await ctx.collection()).deleteMany({ docId })).deletedCount;

/** Deletes autosaves older than the date with a later non-autosave revision after them. */
export const pruneAutosaves = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  olderThan: Date,
): Promise<number> => {
  const collection = await ctx.collection();
  const lastSave = await collection.findOne(
    { docId, kind: { $ne: "autosave" } },
    { sort: { seq: -1 }, projection: { seq: 1 } },
  );
  if (!lastSave) return 0;
  const result = await collection.deleteMany({
    docId,
    kind: "autosave",
    seq: { $lt: lastSave.seq },
    createdAt: { $lt: olderThan },
  });
  return result.deletedCount;
};
