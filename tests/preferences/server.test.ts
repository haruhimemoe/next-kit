/**
 * @file tests/preferences/server.test.ts
 * @desc readPreferences, writePreferences and createPreferencesRoute on the in-memory
 *       MongoDB: the writer touches only `preferences` on identity.user, the reader falls back
 *       to defaults on a bad stored value, and the route refuses a signed-out POST, a
 *       cross-site POST and a schema failure, same as every other hub write.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  createPreferencesRoute,
  readPreferences,
  writePreferences,
} from "../../src/preferences/server.js";
import { testDatabase } from "../helpers/db.js";

const { db } = testDatabase("preferences-server");
const HUB = "https://haruhime.moe";

const req = (body: unknown, origin: string = HUB) =>
  new Request(`${HUB}/api/account/preferences`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "sec-fetch-site": "same-origin" },
    body: JSON.stringify(body),
  });

describe("readPreferences / writePreferences", () => {
  it("writes only the preferences field", async () => {
    const uid = new ObjectId();
    await db().collection("user").insertOne({ _id: uid, name: "a", preferences: null });
    await writePreferences(db(), String(uid), { timezone: "Asia/Tokyo", hourCycle: "h12" });
    const row = await db().collection("user").findOne({ _id: uid });
    expect(row?.name).toBe("a");
    expect(await readPreferences(db(), String(uid))).toEqual({
      timezone: "Asia/Tokyo",
      hourCycle: "h12",
    });
  });

  it("falls back to defaults for a user with no stored preferences", async () => {
    const uid = new ObjectId();
    await db().collection("user").insertOne({ _id: uid, name: "b" });
    expect(await readPreferences(db(), String(uid))).toEqual({
      timezone: null,
      hourCycle: null,
    });
  });
});

describe("createPreferencesRoute", () => {
  it("GET answers the signed-in caller's preferences, 401 signed out", async () => {
    const uid = new ObjectId();
    await db()
      .collection("user")
      .insertOne({ _id: uid, name: "c", preferences: '{"timezone":"UTC","hourCycle":"h23"}' });
    const signedIn = createPreferencesRoute({
      db: db(),
      getSession: async () => ({ user: { id: String(uid) } }),
    });
    const response = await signedIn.GET(new Request(`${HUB}/api/account/preferences`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ timezone: "UTC", hourCycle: "h23" });
    expect(response.headers.get("cache-control")).toBe("no-store");

    const signedOut = createPreferencesRoute({ db: db(), getSession: async () => null });
    expect((await signedOut.GET(new Request(`${HUB}/api/account/preferences`))).status).toBe(401);
  });

  it("POST refuses signed out, cross-site and bad zones", async () => {
    const uid = new ObjectId();
    await db().collection("user").insertOne({ _id: uid, name: "d" });
    const route = createPreferencesRoute({ db: db(), getSession: async () => null });
    expect((await route.POST(req({ timezone: "UTC", hourCycle: null }))).status).toBe(401);

    const signedIn = createPreferencesRoute({
      db: db(),
      getSession: async () => ({ user: { id: String(uid) } }),
    });
    expect((await signedIn.POST(req({ timezone: "UTC" }, "https://evil.example"))).status).toBe(
      403,
    );
    expect((await signedIn.POST(req({ timezone: "Mars/Base", hourCycle: null }))).status).toBe(400);
  });

  it("POST writes valid preferences and answers them", async () => {
    const uid = new ObjectId();
    await db().collection("user").insertOne({ _id: uid, name: "e" });
    const signedIn = createPreferencesRoute({
      db: db(),
      getSession: async () => ({ user: { id: String(uid) } }),
    });
    const response = await signedIn.POST(req({ timezone: "Europe/Berlin", hourCycle: "h23" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ timezone: "Europe/Berlin", hourCycle: "h23" });
    expect(await readPreferences(db(), String(uid))).toEqual({
      timezone: "Europe/Berlin",
      hourCycle: "h23",
    });
  });
});
