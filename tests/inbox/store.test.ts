/**
 * @file tests/inbox/store.test.ts
 * @desc createInboxStore on the in-memory MongoDB: invite upsert by id, another app's id
 *       refused, invitesFor both directions, notifications' unread filter and limit, markRead
 *       scoped to the user, deleteFor, and the index specs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { inboxIndexSpecs, NOTIFICATION_TTL_SECONDS } from "../../src/inbox/specs.js";
import { createInboxStore } from "../../src/inbox/store.js";
import { indexName } from "../../src/mongo/indexes.js";
import { testDatabase } from "../helpers/db.js";

const { connectedDb } = testDatabase("inbox-store");
let clock = Date.parse("2026-10-06T12:00:00.000Z");
const store = createInboxStore(connectedDb, () => clock++);
const ME = new ObjectId().toHexString();
const YOU = new ObjectId().toHexString();
const invite = (id: string, from: number, to: number, state = "pending") => ({
  id,
  app: "tourney",
  from,
  to,
  state,
  doc: { team: "a" },
});

describe("invites", () => {
  it("upserts by id and finds both directions, newest first", async () => {
    expect(await store.putInvite(invite("i1", 1, 2))).toBe(true);
    expect(await store.putInvite(invite("i2", 2, 3))).toBe(true);
    expect(await store.putInvite(invite("i1", 1, 2, "accepted"))).toBe(true);
    const found = await store.invitesFor(2);
    expect(found.map((i) => [i.id, i.state])).toEqual([
      ["i1", "accepted"],
      ["i2", "pending"],
    ]);
    expect(found[0]).toMatchObject({ app: "tourney", doc: { team: "a" } });
    expect(await store.invitesFor(3)).toHaveLength(1);
  });

  it("refuses an id another app holds, writing nothing", async () => {
    await store.putInvite(invite("i1", 1, 2));
    expect(await store.putInvite({ ...invite("i1", 9, 9), app: "packs" })).toBe(false);
    expect((await store.invitesFor(1))[0]).toMatchObject({ app: "tourney", from: 1 });
  });
});

describe("notifications", () => {
  it("lists newest first, unread only, and caps the limit", async () => {
    const first = await store.notify({ userId: ME, app: "packs", kind: "x", title: "one" });
    await store.notify({ userId: ME, app: "packs", kind: "x", title: "two", href: "/p/1" });
    await store.notify({ userId: YOU, app: "packs", kind: "x", title: "theirs" });
    expect((await store.notificationsFor(ME)).map((n) => n.title)).toEqual(["two", "one"]);
    expect(await store.markRead(ME, [first])).toBe(1);
    const unread = await store.notificationsFor(ME, { unreadOnly: true });
    expect(unread.map((n) => [n.title, n.href, n.readAt])).toEqual([["two", "/p/1", null]]);
    expect(await store.notificationsFor(ME, { limit: 1 })).toHaveLength(1);
    expect(await store.notificationsFor("nope")).toEqual([]);
  });

  it("marks only the user's own as read", async () => {
    const theirs = await store.notify({ userId: YOU, app: "bb", kind: "x", title: "t" });
    expect(await store.markRead(ME, [theirs, "bad"])).toBe(0);
    expect(await store.markRead(ME, [])).toBe(0);
    expect((await store.notificationsFor(YOU, { unreadOnly: true })).length).toBe(1);
  });

  it("refuses a malformed user id", async () => {
    await expect(store.notify({ userId: "x", app: "bb", kind: "k", title: "t" })).rejects.toThrow(
      TypeError,
    );
  });
});

describe("deleteFor", () => {
  it("removes the user's notifications and invites to or from them", async () => {
    await store.notify({ userId: ME, app: "bb", kind: "k", title: "t" });
    await store.notify({ userId: YOU, app: "bb", kind: "k", title: "t" });
    await store.putInvite(invite("a", 1, 2));
    await store.putInvite(invite("b", 3, 1));
    await store.putInvite(invite("c", 3, 4));
    expect(await store.deleteFor(ME, 1)).toBe(3);
    expect(await store.notificationsFor(YOU)).toHaveLength(1);
    expect(await store.invitesFor(3)).toHaveLength(1);
  });
});

describe("inboxIndexSpecs", () => {
  it("indexes invites both ways and expires notifications after 90 days", () => {
    expect(inboxIndexSpecs.map((spec) => indexName(spec))).toEqual([
      "inbox_invite_to",
      "inbox_invite_from",
      "inbox_notification_user",
      "inbox_notification_ttl",
    ]);
    expect(inboxIndexSpecs[3]?.expireAfterSeconds).toBe(NOTIFICATION_TTL_SECONDS);
    expect(NOTIFICATION_TTL_SECONDS).toBe(7_776_000);
  });
});
