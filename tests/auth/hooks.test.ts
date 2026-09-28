/**
 * @file tests/auth/hooks.test.ts
 * @desc createOsuAuth's signed-in marker and hooks: pools' marker cases (set on sign-in,
 *       refreshed by get-session, cleared without a session and on sign-out) and editor linking
 *       after a first sign-in, and packs' system accounts (no session or osu! link ever, however
 *       a sign-in resolves), as the hooks both apps pass.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { type AuthRow, getOsuUser, OSU_PROVIDER_ID } from "../../src/auth/index.js";
import { setupMsw } from "../../src/testing/index.js";
import {
  authRequest,
  cookiesFrom,
  createTestUser,
  MARKER,
  makeAuth,
  OSU_HANDLERS,
  PROFILE,
  signInWithOsu,
} from "../helpers/auth.js";
import { testDatabase } from "../helpers/db.js";

setupMsw(...OSU_HANDLERS);
const { client, db } = testDatabase("auth-hooks");

const markerFrom = (response: Response): string | undefined =>
  response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${MARKER}=`));

describe("signed-in marker cookie", () => {
  const auth = makeAuth(db(), client);

  it("is set, readable by the page, when osu! sign-in completes", async () => {
    const marker = markerFrom(await signInWithOsu(auth, PROFILE(3)));
    expect(marker).toMatch(/^kit-signed-in=1;/);
    expect(marker).toMatch(/Max-Age=\d{5,}/);
    expect(marker).toMatch(/Path=\//);
    expect(marker).toMatch(/SameSite=Lax/i);
    expect(marker).not.toMatch(/HttpOnly/i);
    expect(marker).not.toMatch(/Secure/i);
  });

  it("is refreshed by a get-session that finds a session", async () => {
    const user = await createTestUser(auth, 4);
    const response = await auth.handler(authRequest("get-session", user.cookie));
    expect(markerFrom(response)).toMatch(/^kit-signed-in=1;/);
  });

  it("is cleared by a get-session without a session, and on sign-out", async () => {
    const empty = await auth.handler(authRequest("get-session", `${MARKER}=1`));
    expect(markerFrom(empty)).toMatch(/^kit-signed-in=;.*Max-Age=0/);
    const user = await createTestUser(auth, 6);
    const out = await auth.handler(authRequest("sign-out", user.cookie, "POST"));
    expect(markerFrom(out)).toMatch(/^kit-signed-in=;.*Max-Age=0/);
  });

  it("leaves other routes alone", async () => {
    const response = await auth.handler(authRequest("ok"));
    expect(markerFrom(response)).toBeUndefined();
  });
});

describe("afterUserCreate (pools: link the pools a new user edits)", () => {
  it("runs once for a new user, and a failure never fails the sign-in", async () => {
    const created: AuthRow[] = [];
    const afterUserCreate = vi.fn(async (user: AuthRow) => {
      created.push(user);
      throw new Error("editor links down");
    });
    const auth = makeAuth(db(), client, { afterUserCreate });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const callback = await signInWithOsu(auth, PROFILE(8));
    await signInWithOsu(auth, PROFILE(8));
    expect(quiet).toHaveBeenCalledWith("[auth] afterUserCreate failed", expect.any(Error));
    quiet.mockRestore();
    expect(callback.headers.get("location")).toBe("/admin");
    expect(afterUserCreate).toHaveBeenCalledTimes(1);
    expect(created[0]).toMatchObject({ osuId: 8, id: expect.any(String) });
  });
});

describe("guards (packs: system accounts never sign in)", () => {
  const isSystem = async (row: AuthRow): Promise<boolean> =>
    (await db()
      .collection("user")
      .countDocuments({ _id: new ObjectId(String(row.userId)), system: true })) > 0;
  const auth = makeAuth(db(), client, {
    beforeAccountCreate: async (account) => !(await isSystem(account)),
    beforeSessionCreate: async (session) => !(await isSystem(session)),
  });
  const systemUser = async (): Promise<ObjectId> => {
    const now = new Date();
    const { insertedId } = await db().collection("user").insertOne({
      email: "pools@system.local",
      emailVerified: false,
      name: "haruhime pools",
      osuId: 0,
      username: "haruhime pools",
      system: true,
      createdAt: now,
      updatedAt: now,
    });
    return insertedId;
  };

  it("never gets a session or an osu! account link from better-auth", async () => {
    const id = String(await systemUser());
    const ctx = await auth.$context;
    expect(await ctx.internalAdapter.createSession(id, false)).toBeNull();
    const link = { userId: id, providerId: OSU_PROVIDER_ID, accountId: "3" };
    expect(await ctx.internalAdapter.createAccount(link)).toBeNull();
    expect(await db().collection("session").countDocuments()).toBe(0);
    expect(await db().collection("account").countDocuments()).toBe(0);
  });

  it("refuses the sign-in even when an osu! account was linked to it", async () => {
    const id = await systemUser();
    const now = new Date();
    await db().collection("account").insertOne({
      userId: id,
      providerId: OSU_PROVIDER_ID,
      accountId: "2",
      createdAt: now,
      updatedAt: now,
    });
    const callback = await signInWithOsu(auth, PROFILE(2));
    expect(callback.headers.get("location")).toMatch(/error/);
    expect(await getOsuUser(auth, new Headers({ cookie: cookiesFrom(callback) }))).toBeNull();
    expect(await db().collection("session").countDocuments()).toBe(0);
  });

  it("lets everyone else through", async () => {
    await systemUser();
    const callback = await signInWithOsu(auth, PROFILE(2));
    const user = await getOsuUser(auth, new Headers({ cookie: cookiesFrom(callback) }));
    expect(user).toMatchObject({ osuId: 2 });
  });

  it("refuses a new user when beforeUserCreate says no", async () => {
    const closed = makeAuth(db(), client, { beforeUserCreate: async () => false });
    const callback = await signInWithOsu(closed, PROFILE(9));
    expect(callback.headers.get("location")).toMatch(/error/);
    expect(await db().collection("user").countDocuments()).toBe(0);
    const open = makeAuth(db(), client, { beforeUserCreate: async () => true });
    await signInWithOsu(open, PROFILE(9));
    expect(await db().collection("user").countDocuments()).toBe(1);
  });
});
