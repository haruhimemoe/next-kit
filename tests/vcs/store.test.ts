/**
 * @file tests/vcs/store.test.ts
 * @desc createRevisionStore against the in-memory MongoDB: options, create, head, get, list,
 *       indexes, diff, renames, removal and pruning.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { defineCodec } from "@haruhimemoe/vcs";
import { describe, expect, it } from "vitest";
import { createRevisionStore } from "../../src/vcs/index.js";
import { testDatabase } from "../helpers/db.js";

type Pool = { name: string; slots: { id: string; mod: string }[]; updatedAt?: number };

const { db, connectedDb } = testDatabase("vcs-store");
let clock = Date.parse("2026-10-04T12:00:00.000Z");
const codec = defineCodec({ lists: { slots: (s: { id: string }) => s.id }, ignore: ["updatedAt"] });
const store = createRevisionStore<Pool>({
  db: connectedDb,
  collection: "pool_revisions",
  codec,
  now: () => clock,
});
const alice = { id: "1", name: "alice" };
const pool = (name: string, ...slots: string[]): Pool => ({
  name,
  slots: slots.map((id) => ({ id, mod: "NM" })),
});
const docs = () => db().collection("pool_revisions");

describe("createRevisionStore", () => {
  it.each([
    [{ collection: "" }, "collection is required"],
    [{ collection: "r", maxRevisions: 0 }, "maxRevisions must be a positive integer"],
    [{ collection: "r", maxBytes: 1.5 }, "maxBytes must be a positive integer"],
  ])("refuses %j", (options, message) => {
    expect(() => createRevisionStore({ db: connectedDb, ...options })).toThrow(message);
  });

  it("names its indexes and builds them", async () => {
    expect(store.indexSpecs().map((s) => s.key)).toEqual([
      { docId: 1, seq: -1 },
      { authorId: 1 },
      { docId: 1, kind: 1, createdAt: 1 },
    ]);
    await store.ensureIndexes();
    const names = (await docs().indexes()).map((i) => i.name);
    expect(names).toContain("docId_1_seq_-1");
  });
});

describe("create, head, get, list", () => {
  it("writes a root revision and reads it back", async () => {
    const root = await store.create("p1", pool("a", "x"), alice, "first");
    expect(root).toMatchObject({
      docId: "p1",
      seq: 0,
      kind: "root",
      authorId: "1",
      authorName: "alice",
      message: "first",
      createdAt: "2026-10-04T12:00:00.000Z",
      value: pool("a", "x"),
    });
    expect(root.valueHash).toMatch(/^[0-9a-f]{64}$/);
    expect(root.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await store.head("p1")).toEqual(root);
    expect(await store.get("p1", root.id)).toEqual(root);
    expect(await store.get("other", root.id)).toBeNull();
    expect(await store.head("none")).toBeNull();
  });

  it("refuses a second root", async () => {
    await store.ensureIndexes();
    await store.create("p1", pool("a"), alice);
    await expect(store.create("p1", pool("b"), alice)).rejects.toThrow("p1 already has history");
  });

  it("passes other insert errors through", async () => {
    const strict = createRevisionStore<Pool>({
      db: connectedDb,
      collection: "strict",
      check: () => {
        throw new Error("filtered");
      },
    });
    await expect(strict.create("p", pool("a"), alice)).rejects.toThrow("filtered");
  });

  it("lists newest first without values, paged by seq", async () => {
    const root = await store.create("p1", pool("a"), alice);
    let base = { id: root.id, seq: root.seq };
    for (const name of ["b", "c", "d"]) {
      const result = await store.commit({ docId: "p1", base, value: pool(name), author: alice });
      if (result.status !== "committed") throw new Error(result.status);
      base = { id: result.revision.id, seq: result.revision.seq };
    }
    const page = await store.list("p1", { limit: 2 });
    expect(page.map((r) => r.seq)).toEqual([3, 2]);
    expect(page[0]).not.toHaveProperty("value");
    expect(page[0]?.createdAt).toBe("2026-10-04T12:00:00.000Z");
    expect((await store.list("p1", { before: 2 })).map((r) => r.seq)).toEqual([1, 0]);
    expect(await store.list("p1", { limit: 0 })).toHaveLength(1);
    expect(await store.list("p1", { before: Number.NaN })).toHaveLength(4);
    await db()
      .collection("pool_revisions")
      .updateMany({}, { $set: { stray: 1 } });
    expect(await store.head("p1")).not.toHaveProperty("stray");
    expect((await store.list("p1"))[0]).not.toHaveProperty("stray");
    expect(await store.list("p1", { limit: 1000 })).toHaveLength(4);
  });
});

describe("diff, renameAuthor, removeDoc", () => {
  it("diffs two revisions through the codec", async () => {
    const root = await store.create("p1", pool("a", "x"), alice);
    const next = await store.commit({
      docId: "p1",
      base: root,
      value: { ...pool("a", "x", "y"), updatedAt: 5 },
      author: alice,
    });
    if (next.status !== "committed") throw new Error(next.status);
    expect(await store.diff("p1", root.id, next.revision.id)).toEqual([
      {
        path: "slots",
        segments: ["slots"],
        op: "add",
        key: "y",
        value: { id: "y", mod: "NM" },
        index: 1,
      },
    ]);
    expect(await store.diff("p1", root.id, "gone")).toBeNull();
  });

  it("renames an author everywhere and removes a whole history", async () => {
    await store.create("p1", pool("a"), alice);
    await store.create("p2", pool("b"), alice);
    expect(await store.renameAuthor("1", "deleted user")).toBe(2);
    expect((await store.head("p2"))?.authorName).toBe("deleted user");
    expect(await store.removeDoc("p1")).toBe(1);
    expect(await store.head("p1")).toBeNull();
  });
});

describe("pruneAutosaves", () => {
  it("deletes old autosaves that a save follows, never the latest", async () => {
    const root = await store.create("p1", pool("a"), alice);
    let base = { id: root.id, seq: root.seq };
    const commit = async (name: string, kind: "save" | "autosave") => {
      const r = await store.commit({ docId: "p1", base, value: pool(name), author: alice, kind });
      if (r.status !== "committed") throw new Error(r.status);
      base = { id: r.revision.id, seq: r.revision.seq };
    };
    await commit("b", "autosave");
    await commit("c", "autosave");
    await commit("d", "save");
    clock += 1000;
    await commit("e", "autosave");
    expect(await store.pruneAutosaves("p1", new Date(clock))).toBe(2);
    expect((await store.list("p1")).map((r) => r.kind)).toEqual(["autosave", "save", "root"]);
    expect(await store.pruneAutosaves("none", new Date(clock))).toBe(0);
  });
});
