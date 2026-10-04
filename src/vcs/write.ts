/**
 * @file src/vcs/write.ts
 * @desc The one way a revision gets written: size cap, then the app's check, then an insert at a
 *       given seq. The unique (docId, seq) index makes a second writer at the same seq fail with
 *       a duplicate key, which the caller retries. After an insert, the oldest autosaves past
 *       maxRevisions go. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { canonicalJson, hashValue, type Revision, withoutIgnored } from "@haruhimemoe/vcs";
import type { RevisionDoc } from "./docs.js";
import { toRevision } from "./docs.js";
import type { StoreContext } from "./read.js";
import type { RevisionAuthor } from "./types.js";

/** What insertRevision writes besides the value. */
export type NewRevision<T> = Pick<RevisionDoc<T>, "docId" | "seq" | "kind"> & {
  value: T;
  author: RevisionAuthor;
  message?: string | null | undefined;
  base?: string | undefined;
};

/**
 * @function valueHash
 * @param ctx {StoreContext<T>} the store
 * @param value {T} a value
 * @returns {Promise<string>} the hash of the value without the codec's ignored paths
 */
export const valueHash = <T>(ctx: StoreContext<T>, value: T): Promise<string> =>
  hashValue(withoutIgnored(value, ctx.options.codec));

/**
 * @function insertRevision
 * @param ctx {StoreContext<T>} the store
 * @param input {NewRevision<T>} the revision to write
 * @param hash {string | undefined} the value's hash, when the caller already has it
 * @returns {Promise<Revision<T>>} the written revision
 * @throws {RangeError} past maxBytes; whatever `check` throws; a duplicate key error when the
 *         seq is taken
 */
export const insertRevision = async <T>(
  ctx: StoreContext<T>,
  input: NewRevision<T>,
  hash?: string,
): Promise<Revision<T>> => {
  const { options } = ctx;
  const size = new TextEncoder().encode(canonicalJson(input.value)).length;
  if (size > options.maxBytes)
    throw new RangeError(`revision is ${size} bytes, over the ${options.maxBytes} limit`);
  await options.check?.(input.value, input.kind);
  const doc: RevisionDoc<T> = {
    _id: globalThis.crypto.randomUUID(),
    docId: input.docId,
    seq: input.seq,
    kind: input.kind,
    valueHash: hash ?? (await valueHash(ctx, input.value)),
    authorId: input.author.id,
    authorName: input.author.name,
    message: input.message ?? null,
    createdAt: new Date(options.now()),
    ...(input.base === undefined ? {} : { base: input.base }),
    value: input.value,
  };
  const collection = await ctx.collection();
  await collection.insertOne(doc as never);
  // Best effort: the revision is written, so a failed prune must not look like a failed save.
  await pruneOverCap(ctx, input.docId, input.seq).catch((error: unknown) => {
    console.error(`revisions: pruning ${input.docId} failed`, error);
  });
  return toRevision(doc);
};

/** Deletes the oldest autosaves (never the head) while the document is over maxRevisions. */
const pruneOverCap = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  headSeq: number,
): Promise<void> => {
  const collection = await ctx.collection();
  const over = (await collection.countDocuments({ docId })) - ctx.options.maxRevisions;
  if (over <= 0) return;
  const oldest = await collection
    .find({ docId, kind: "autosave", seq: { $lt: headSeq } }, { projection: { _id: 1 } })
    .sort({ seq: 1 })
    .limit(over)
    .toArray();
  if (oldest.length > 0)
    await collection.deleteMany({ _id: { $in: oldest.map((doc) => doc._id) } } as never);
};
