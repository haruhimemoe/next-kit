/**
 * @file src/vcs/commit.ts
 * @desc create, commit and revert. A commit whose base is the head writes the value as is. When
 *       the head moved on, the value is merged onto it (base: the client's revision, or the
 *       nearest earlier one if that was pruned); a clean merge is written as kind "merge", a
 *       conflict writes nothing. A value that hashes like the head writes nothing either. When
 *       another writer takes the next seq first, the whole thing reruns, up to COMMIT_ATTEMPTS.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { mergeValue, type Revision } from "@haruhimemoe/vcs";
import { isDuplicateKeyError } from "../mongo/duplicate.js";
import { COMMIT_ATTEMPTS } from "./options.js";
import { readAtOrBefore, readHead, readOne, type StoreContext } from "./read.js";
import type { CommitInput, CommitResult, RevisionAuthor } from "./types.js";
import { insertRevision, type NewRevision, valueHash } from "./write.js";

/**
 * @function createHistory
 * @param ctx {StoreContext<T>} the store
 * @param docId {string} the document
 * @param value {T} its first value
 * @param author {RevisionAuthor} who made it
 * @param message {string | null | undefined} an optional note
 * @returns {Promise<Revision<T>>} the root revision (seq 0)
 * @throws {Error} when the document already has history
 */
export const createHistory = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  value: T,
  author: RevisionAuthor,
  message?: string | null,
): Promise<Revision<T>> => {
  try {
    return await insertRevision(ctx, { docId, seq: 0, kind: "root", value, author, message });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new Error(`createHistory: ${docId} already has history`);
    throw error;
  }
};

/** Writes at head.seq + 1 unless the value equals head. null: someone else took the seq. */
const writeNext = async <T>(
  ctx: StoreContext<T>,
  head: Revision<T>,
  input: Omit<NewRevision<T>, "seq">,
  merged: boolean,
): Promise<CommitResult<T> | null> => {
  const hash = await valueHash(ctx, input.value);
  if (hash === head.valueHash) return { status: "unchanged", revision: head };
  try {
    const revision = await insertRevision(ctx, { ...input, seq: head.seq + 1 }, hash);
    return { status: merged ? "merged" : "committed", revision };
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;
    throw error;
  }
};

const tooBusy = (docId: string): Error =>
  new Error(`commit: ${docId} kept changing; gave up after ${COMMIT_ATTEMPTS} attempts`);

/**
 * @function commitRevision
 * @param ctx {StoreContext<T>} the store
 * @param input {CommitInput<T>} the document, the client's base revision, the value and author
 * @returns {Promise<CommitResult<T>>} committed, merged, unchanged, conflict or missing
 * @throws {Error} when other writers win COMMIT_ATTEMPTS times in a row; RangeError past
 *         maxBytes; whatever `check` throws
 */
export const commitRevision = async <T>(
  ctx: StoreContext<T>,
  { docId, base, value, author, kind = "save", message = null }: CommitInput<T>,
): Promise<CommitResult<T>> => {
  for (let attempt = 0; attempt < COMMIT_ATTEMPTS; attempt++) {
    const head = await readHead(ctx, docId);
    if (!head || base.seq > head.seq) return { status: "missing" };
    let result: CommitResult<T> | null;
    if (base.id === head.id) {
      result = await writeNext(ctx, head, { docId, kind, value, author, message }, false);
    } else {
      const from =
        (await readOne(ctx, docId, base.id)) ?? (await readAtOrBefore(ctx, docId, base.seq - 1));
      if (!from) return { status: "missing" };
      const merged = mergeValue(from.value, value, head.value, ctx.options.codec);
      if (!merged.clean) return { status: "conflict", head, merged };
      result = await writeNext(
        ctx,
        head,
        { docId, kind: "merge", value: merged.value, author, message, base: from.id },
        true,
      );
    }
    if (result) return result;
  }
  throw tooBusy(docId);
};

/**
 * @function revertRevision
 * @param ctx {StoreContext<T>} the store
 * @param docId {string} the document
 * @param id {string} the revision whose value to restore
 * @param author {RevisionAuthor} who is reverting
 * @returns {Promise<CommitResult<T>>} committed (kind "revert", base = id), unchanged when the
 *          head already holds that value, or missing
 * @throws {Error} as commitRevision
 */
export const revertRevision = async <T>(
  ctx: StoreContext<T>,
  docId: string,
  id: string,
  author: RevisionAuthor,
): Promise<CommitResult<T>> => {
  for (let attempt = 0; attempt < COMMIT_ATTEMPTS; attempt++) {
    const [head, target] = await Promise.all([readHead(ctx, docId), readOne(ctx, docId, id)]);
    if (!head || !target) return { status: "missing" };
    const input = { docId, kind: "revert" as const, value: target.value, author, base: id };
    const result = await writeNext(ctx, head, input, false);
    if (result) return result;
  }
  throw tooBusy(docId);
};
