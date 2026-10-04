/**
 * @file tests/vcs/commit.test.ts
 * @desc commit and revert against the in-memory MongoDB: fast-forward, unchanged, merged,
 *       conflict, missing, the pruned-base fallback, the race between two writers, retries, the
 *       size cap and check, and the revision cap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { defineCodec, type Revision, type RevisionKind } from "@haruhimemoe/vcs";
import { describe, expect, it, vi } from "vitest";
import { createRevisionStore } from "../../src/vcs/index.js";
import { testDatabase } from "../helpers/db.js";

type Pool = { name: string; slots: { id: string; mod: string }[]; updatedAt?: number };

const { db, connectedDb } = testDatabase("vcs-commit");
const codec = defineCodec({ lists: { slots: (s: { id: string }) => s.id }, ignore: ["updatedAt"] });
const checked: RevisionKind[] = [];
const store = createRevisionStore<Pool>({
  db: connectedDb,
  collection: "revs",
  codec,
  check: (value, kind) => {
    checked.push(kind);
    if (value.name === "banned") throw new Error("filtered");
  },
});
const alice = { id: "1", name: "alice" };
const bob = { id: "2", name: "bob" };
const pool = (name: string, ...slots: string[]): Pool => ({
  name,
  slots: slots.map((id) => ({ id, mod: "NM" })),
});
const ok = <T>(result: { status: string; revision?: Revision<T> }): Revision<T> => {
  if (!result.revision) throw new Error(result.status);
  return result.revision;
};

describe("commit", () => {
  it("fast-forwards when the base is the head", async () => {
    const root = await store.create("p", pool("a"), alice);
    const result = await store.commit({
      docId: "p",
      base: root,
      value: pool("b"),
      author: bob,
      message: "rename",
    });
    expect(result).toMatchObject({
      status: "committed",
      revision: { seq: 1, kind: "save", authorName: "bob", message: "rename" },
    });
  });

  it("writes nothing when only ignored paths changed", async () => {
    const root = await store.create("p", pool("a"), alice);
    const result = await store.commit({
      docId: "p",
      base: root,
      value: { ...pool("a"), updatedAt: 9 },
      author: alice,
    });
    expect(result).toEqual({ status: "unchanged", revision: root });
    expect(await db().collection("revs").countDocuments()).toBe(1);
  });

  it("merges a stale save onto the head", async () => {
    const root = await store.create("p", pool("a", "x"), alice);
    ok(await store.commit({ docId: "p", base: root, value: pool("b", "x"), author: alice }));
    const result = await store.commit({
      docId: "p",
      base: root,
      value: pool("a", "x", "y"),
      author: bob,
    });
    expect(result.status).toBe("merged");
    expect(ok(result)).toMatchObject({
      seq: 2,
      kind: "merge",
      base: root.id,
      value: pool("b", "x", "y"),
    });
  });

  it("returns unchanged when the merge equals the head", async () => {
    const root = await store.create("p", pool("a"), alice);
    const head = ok(
      await store.commit({ docId: "p", base: root, value: pool("b"), author: alice }),
    );
    expect(await store.commit({ docId: "p", base: root, value: pool("b"), author: bob })).toEqual({
      status: "unchanged",
      revision: head,
    });
  });

  it("returns a conflict and writes nothing", async () => {
    const root = await store.create("p", pool("a"), alice);
    const head = ok(
      await store.commit({ docId: "p", base: root, value: pool("b"), author: alice }),
    );
    const result = await store.commit({ docId: "p", base: root, value: pool("c"), author: bob });
    expect(result).toMatchObject({
      status: "conflict",
      head,
      merged: { clean: false, value: pool("c"), conflicts: [{ path: "name", kind: "value" }] },
    });
    expect(await db().collection("revs").countDocuments()).toBe(2);
  });

  it("returns missing for an unknown doc or a base past the head", async () => {
    const root = await store.create("p", pool("a"), alice);
    expect(await store.commit({ docId: "q", base: root, value: pool("b"), author: alice })).toEqual(
      { status: "missing" },
    );
    expect(
      await store.commit({
        docId: "p",
        base: { id: "x", seq: 5 },
        value: pool("b"),
        author: alice,
      }),
    ).toEqual({
      status: "missing",
    });
  });

  it("merges from the nearest earlier revision when the base was pruned", async () => {
    const root = await store.create("p", pool("a", "x"), alice);
    const auto = ok(
      await store.commit({
        docId: "p",
        base: root,
        value: pool("a", "x", "y"),
        author: alice,
        kind: "autosave",
      }),
    );
    ok(await store.commit({ docId: "p", base: auto, value: pool("b", "x", "y"), author: alice }));
    await db()
      .collection("revs")
      .deleteOne({ _id: auto.id } as never);
    const result = await store.commit({
      docId: "p",
      base: auto,
      value: pool("a", "x", "y", "z"),
      author: bob,
    });
    expect(ok(result)).toMatchObject({
      kind: "merge",
      base: root.id,
      value: pool("b", "x", "y", "z"),
    });
  });

  it("returns missing when nothing at or before the base survives", async () => {
    const root = await store.create("p", pool("a"), alice);
    ok(await store.commit({ docId: "p", base: root, value: pool("b"), author: alice }));
    await db()
      .collection("revs")
      .deleteOne({ _id: root.id } as never);
    expect(await store.commit({ docId: "p", base: root, value: pool("c"), author: bob })).toEqual({
      status: "missing",
    });
  });

  it("lands both of two racing saves, one as a merge", async () => {
    await store.ensureIndexes();
    const root = await store.create("p", pool("a", "x"), alice);
    const [one, two] = await Promise.all([
      store.commit({ docId: "p", base: root, value: pool("a", "x", "y"), author: alice }),
      store.commit({ docId: "p", base: root, value: pool("a", "w", "x"), author: bob }),
    ]);
    expect([one.status, two.status].sort()).toEqual(["committed", "merged"]);
    expect((await store.head("p"))?.value).toEqual(pool("a", "w", "x", "y"));
  });

  it("gives up after losing the seq three times", async () => {
    await store.ensureIndexes();
    const root = await store.create("p", pool("a"), alice);
    const insert = vi.spyOn(
      (await connectedDb()).collection("revs").constructor.prototype,
      "insertOne",
    );
    insert.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    await expect(
      store.commit({ docId: "p", base: root, value: pool("b"), author: alice }),
    ).rejects.toThrow("p kept changing; gave up after 3 attempts");
    await expect(store.revert("p", root.id, alice)).resolves.toMatchObject({ status: "unchanged" });
    insert.mockRestore();
  });

  it("passes other insert errors through", async () => {
    const root = await store.create("p", pool("a"), alice);
    const insert = vi.spyOn(
      (await connectedDb()).collection("revs").constructor.prototype,
      "insertOne",
    );
    insert.mockRejectedValue(new Error("network"));
    await expect(
      store.commit({ docId: "p", base: root, value: pool("b"), author: alice }),
    ).rejects.toThrow("network");
    insert.mockRestore();
  });

  it("runs check on every write, merges included, and refuses too-large values", async () => {
    checked.length = 0;
    const root = await store.create("p", pool("a", "x"), alice);
    ok(await store.commit({ docId: "p", base: root, value: pool("b", "x"), author: alice }));
    const merged = ok(
      await store.commit({ docId: "p", base: root, value: pool("a", "x", "y"), author: alice }),
    );
    expect(checked).toEqual(["root", "save", "merge"]);
    await expect(
      store.commit({ docId: "p", base: merged, value: pool("banned"), author: alice }),
    ).rejects.toThrow("filtered");
    const small = createRevisionStore<Pool>({ db: connectedDb, collection: "small", maxBytes: 30 });
    await expect(small.create("p", pool("a", "x", "y"), alice)).rejects.toThrow(
      /bytes, over the 30 limit/,
    );
  });

  it("deletes the oldest autosaves past maxRevisions, never saves", async () => {
    const capped = createRevisionStore<Pool>({
      db: connectedDb,
      collection: "capped",
      maxRevisions: 3,
    });
    let base: Revision<Pool> = await capped.create("p", pool("0"), alice);
    for (const [name, kind] of [
      ["1", "autosave"],
      ["2", "save"],
      ["3", "autosave"],
      ["4", "save"],
      ["5", "save"],
    ] as const)
      base = ok(await capped.commit({ docId: "p", base, value: pool(name), author: alice, kind }));
    expect((await capped.list("p")).map((r) => `${r.seq}${r.kind[0]}`)).toEqual([
      "5s",
      "4s",
      "2s",
      "0r",
    ]);
  });
});

describe("revert", () => {
  it("commits an old value again, through check", async () => {
    const root = await store.create("p", pool("a"), alice);
    ok(await store.commit({ docId: "p", base: root, value: pool("b"), author: alice }));
    checked.length = 0;
    const result = await store.revert("p", root.id, bob);
    expect(ok(result)).toMatchObject({ seq: 2, kind: "revert", base: root.id, value: pool("a") });
    expect(checked).toEqual(["revert"]);
    expect(await store.revert("p", root.id, bob)).toMatchObject({ status: "unchanged" });
    expect(await store.revert("p", "gone", bob)).toEqual({ status: "missing" });
  });
});
