/**
 * @file src/vcs/types.ts
 * @desc The revision store's public shapes: its options, who is writing, what commit and revert
 *       return, and the store itself.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import type {
  Change,
  Codec,
  Revision,
  RevisionKind,
  RevisionMeta,
  RevisionRef,
  ValueMerge,
} from "@haruhimemoe/vcs";
import type { Db } from "mongodb";
import type { IndexSpec } from "../mongo/indexes.js";

/** Who is writing a revision. */
export type RevisionAuthor = { id: string; name: string };

/** createRevisionStore's options. */
export type RevisionStoreOptions<T> = {
  /** The connected database. */
  db: () => Promise<Db>;
  /** The app's revisions collection, like "pool_revisions". */
  collection: string;
  /** Keyed lists, text paths and ignored paths of T (default: none). */
  codec?: Codec;
  /** Runs before every write (create, commit, merge, revert). Throw to refuse the value. */
  check?: (value: T, kind: RevisionKind) => void | Promise<void>;
  /** Per document. Past it, the oldest autosaves go; saves are never deleted. Default 1000. */
  maxRevisions?: number;
  /** Largest value, in bytes of canonical JSON. Default 1,000,000. */
  maxBytes?: number;
  /** The clock (ms). Default Date.now. */
  now?: () => number;
};

/** What commit and revert return. Only "committed" and "merged" wrote anything. */
export type CommitResult<T> =
  | { status: "committed"; revision: Revision<T> }
  | { status: "merged"; revision: Revision<T> }
  | { status: "unchanged"; revision: Revision<T> }
  | { status: "conflict"; head: Revision<T>; merged: ValueMerge<T> }
  | { status: "missing" };

/** commit's input. */
export type CommitInput<T> = {
  docId: string;
  /** The revision the client started from (its id and seq). */
  base: RevisionRef;
  value: T;
  author: RevisionAuthor;
  kind?: "save" | "autosave";
  message?: string | null;
};

/** A revision store over one collection. */
export type RevisionStore<T> = {
  /** The indexes the store needs, for the app's own index list. */
  indexSpecs: () => IndexSpec[];
  /** Builds those indexes (logs, never throws). */
  ensureIndexes: () => Promise<void>;
  /** Starts a document's history (seq 0). Throws if it already has one. */
  create: (
    docId: string,
    value: T,
    author: RevisionAuthor,
    message?: string | null,
  ) => Promise<Revision<T>>;
  head: (docId: string) => Promise<Revision<T> | null>;
  get: (docId: string, id: string) => Promise<Revision<T> | null>;
  /** Newest first, without values. `before`: only revisions with a lower seq. */
  list: (docId: string, options?: { before?: number; limit?: number }) => Promise<RevisionMeta[]>;
  commit: (input: CommitInput<T>) => Promise<CommitResult<T>>;
  /** Commits an earlier revision's value again (kind "revert", base = that revision). */
  revert: (docId: string, id: string, author: RevisionAuthor) => Promise<CommitResult<T>>;
  /** The changes from one revision to another, or null if either is gone. */
  diff: (docId: string, fromId: string, toId: string) => Promise<Change[] | null>;
  /** Rewrites an author's name on every revision (renames, deleted accounts). */
  renameAuthor: (authorId: string, name: string) => Promise<number>;
  /** Deletes a document's whole history. */
  removeDoc: (docId: string) => Promise<number>;
  /** Deletes autosaves older than the date that a later non-autosave revision follows. */
  pruneAutosaves: (docId: string, olderThan: Date) => Promise<number>;
};
