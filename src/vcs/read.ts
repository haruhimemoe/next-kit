/**
 * @file src/vcs/read.ts
 * @desc The store's context (options plus the typed collection) and its reads: head, one
 *       revision, the nearest revision at or before a seq, and history pages. Internal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import type { Revision, RevisionMeta } from "@haruhimemoe/vcs";
import type { Collection } from "mongodb";
import { META_PROJECTION, type RevisionDoc, toMeta, toRevision } from "./docs.js";
import type { ResolvedOptions } from "./options.js";

/** Largest history page. */
export const MAX_LIST_LIMIT = 200;
/** History page size when none is asked for. */
export const DEFAULT_LIST_LIMIT = 50;

/** What every store function shares. */
export type StoreContext<T> = {
  options: ResolvedOptions<T>;
  collection: () => Promise<Collection<RevisionDoc<T>>>;
};

/**
 * @function storeContext
 * @param options {ResolvedOptions<T>} resolved options
 * @returns {StoreContext<T>} the context
 */
export const storeContext = <T>(options: ResolvedOptions<T>): StoreContext<T> => ({
  options,
  collection: async () => (await options.db()).collection<RevisionDoc<T>>(options.collection),
});

/** The latest revision of a document, or null. */
export const readHead = async <T>(
  ctx: StoreContext<T>,
  docId: string,
): Promise<Revision<T> | null> => {
  const doc = await (await ctx.collection()).findOne({ docId }, { sort: { seq: -1 } });
  return doc ? toRevision(doc as RevisionDoc<T>) : null;
};

/** One revision of a document, or null. */
export const readOne = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  id: string,
): Promise<Revision<T> | null> => {
  const doc = await (await ctx.collection()).findOne({ _id: id, docId } as never);
  return doc ? toRevision(doc as RevisionDoc<T>) : null;
};

/** A revision by id alone, whatever its document, or null. */
export const readById = async <T>(
  ctx: StoreContext<T>,
  id: string,
): Promise<Revision<T> | null> => {
  const doc = await (await ctx.collection()).findOne({ _id: id } as never);
  return doc ? toRevision(doc as RevisionDoc<T>) : null;
};

/** The revision with the largest seq at or below `seq`, or null. */
export const readAtOrBefore = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  seq: number,
): Promise<Revision<T> | null> => {
  const doc = await (await ctx.collection()).findOne(
    { docId, seq: { $lte: seq } },
    { sort: { seq: -1 } },
  );
  return doc ? toRevision(doc as RevisionDoc<T>) : null;
};

/** A history page, newest first, without values. */
export const readList = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  { before, limit = DEFAULT_LIST_LIMIT }: { before?: number; limit?: number } = {},
): Promise<RevisionMeta[]> => {
  const size = Number.isFinite(limit)
    ? Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(limit)))
    : DEFAULT_LIST_LIMIT;
  const filter =
    before !== undefined && Number.isInteger(before) ? { docId, seq: { $lt: before } } : { docId };
  const docs = await (await ctx.collection())
    .find(filter, { projection: META_PROJECTION, sort: { seq: -1 }, limit: size })
    .toArray();
  return docs.map((doc) => toMeta(doc as Omit<RevisionDoc<unknown>, "value">));
};
