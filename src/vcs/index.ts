/**
 * @file src/vcs/index.ts
 * @desc @haruhimemoe/next-kit/vcs: createRevisionStore, a document history in MongoDB on top of
 *       @haruhimemoe/vcs. One line of revisions per document; a save names the revision it
 *       started from and is merged onto anything that landed since. Routes, auth and who may see
 *       a history stay the app's. Server only: loads mongodb and @haruhimemoe/vcs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { ensureIndexes } from "../mongo/indexes.js";
import { commitRevision, createHistory, revertRevision } from "./commit.js";
import { revisionIndexSpecs } from "./docs.js";
import { diffRevisions, pruneAutosaves, removeHistory, renameAuthor } from "./maintenance.js";
import { resolveOptions } from "./options.js";
import { readHead, readList, readOne, storeContext } from "./read.js";
import type { RevisionStore, RevisionStoreOptions } from "./types.js";

export { revisionIndexSpecs } from "./docs.js";
export {
  COMMIT_ATTEMPTS,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_REVISIONS,
} from "./options.js";
export { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./read.js";
export type {
  CommitInput,
  CommitResult,
  RevisionAuthor,
  RevisionStore,
  RevisionStoreOptions,
} from "./types.js";

/**
 * @function createRevisionStore
 * @param options {RevisionStoreOptions<T>} db, collection, and optional codec, check and limits
 * @returns {RevisionStore<T>} the store
 * @throws {TypeError} for a missing collection or a non-positive limit
 */
export const createRevisionStore = <T>(options: RevisionStoreOptions<T>): RevisionStore<T> => {
  const resolved = resolveOptions(options);
  const ctx = storeContext(resolved);
  return {
    indexSpecs: () => revisionIndexSpecs(resolved.collection),
    ensureIndexes: async () => {
      await ensureIndexes(await resolved.db(), revisionIndexSpecs(resolved.collection));
    },
    create: (docId, value, author, message) => createHistory(ctx, docId, value, author, message),
    head: (docId) => readHead(ctx, docId),
    get: (docId, id) => readOne(ctx, docId, id),
    list: (docId, listOptions) => readList(ctx, docId, listOptions),
    commit: (input) => commitRevision(ctx, input),
    revert: (docId, id, author) => revertRevision(ctx, docId, id, author),
    diff: (docId, fromId, toId) => diffRevisions(ctx, docId, fromId, toId),
    renameAuthor: (authorId, name) => renameAuthor(ctx, authorId, name),
    removeDoc: (docId) => removeHistory(ctx, docId),
    pruneAutosaves: (docId, olderThan) => pruneAutosaves(ctx, docId, olderThan),
  };
};
