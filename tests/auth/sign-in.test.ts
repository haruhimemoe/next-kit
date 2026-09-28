/**
 * @file tests/auth/sign-in.test.ts
 * @desc createOsuAuth end to end on the in-memory MongoDB with osu! mocked: pools' cases
 *       (tests/integration/lib/auth.test.ts: sign-in, no osu! tokens kept, relinking after a
 *       deletion that stopped halfway, the error page, reading the caller) and packs'
 *       (/update-user disabled, a profile without an id refused).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { getOsuUser } from "../../src/auth/index.js";
import { setupMsw } from "../../src/testing/index.js";
import {
  authRequest,
  BASE,
  cookiesFrom,
  createTestUser,
  makeAuth,
  OSU_HANDLERS,
  PROFILE,
  signInWithOsu,
} from "../helpers/auth.js";
import { testDatabase } from "../helpers/db.js";

setupMsw(...OSU_HANDLERS);
const { client, db } = testDatabase("auth-sign-in");
const auth = makeAuth(db(), client);

describe("osu! sign-in", () => {
  it("signs a user in, maps their osu! profile and keeps no osu! tokens", async () => {
    const callback = await signInWithOsu(auth, PROFILE(2));
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/admin");
    const headers = new Headers({ cookie: cookiesFrom(callback) });
    const user = await getOsuUser(auth, headers);
    expect(user).toEqual({
      id: expect.any(String),
      osuId: 2,
      username: "player2",
      avatarUrl: "https://a.ppy.sh/2",
    });
    const row = await db().collection("user").findOne({ osuId: 2 });
    expect(row).toMatchObject({ email: "2@osu.local", name: "player2", countryCode: "AU" });
    expect(row?.image).toBe("https://a.ppy.sh/2");
    const account = await db().collection("account").findOne({ accountId: "2" });
    expect(account?.providerId).toBe("osu");
    expect(account?.accessToken ?? null).toBeNull();
    expect(account?.refreshToken ?? null).toBeNull();
    expect(account?.idToken ?? null).toBeNull();
  });

  it("refreshes the profile on the next sign-in, with one user row", async () => {
    await signInWithOsu(auth, PROFILE(3));
    await signInWithOsu(auth, { ...PROFILE(3), username: "renamed" });
    expect(await db().collection("user").countDocuments({ osuId: 3 })).toBe(1);
    expect((await db().collection("user").findOne({ osuId: 3 }))?.username).toBe("renamed");
  });

  it("signs back in after an account deletion that stopped halfway, relinking the same user", async () => {
    await signInWithOsu(auth, PROFILE(7));
    const users = db().collection("user");
    const before = await users.findOne({ osuId: 7 });
    const { internalAdapter } = await auth.$context;
    await internalAdapter.deleteUserSessions(String(before?._id));
    await internalAdapter.deleteAccounts(String(before?._id));
    const again = await signInWithOsu(auth, PROFILE(7));
    expect(again.headers.get("location")).toBe("/admin");
    const headers = new Headers({ cookie: cookiesFrom(again) });
    expect(await getOsuUser(auth, headers)).toMatchObject({ id: String(before?._id), osuId: 7 });
    expect(await users.countDocuments({ osuId: 7 })).toBe(1);
    const account = await db().collection("account").findOne({ accountId: "7" });
    expect(String(account?.userId)).toBe(String(before?._id));
  });

  it("refuses a profile without an id, keeping nothing", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const callback = await signInWithOsu(auth, { username: "ghost" });
    quiet.mockRestore();
    expect(callback.status).toBeGreaterThanOrEqual(400);
    expect(cookiesFrom(callback)).not.toContain("session_token");
    expect(await db().collection("user").countDocuments()).toBe(0);
  });
});

describe("errors and disabled paths", () => {
  it("sends a callback with a bad state to /signin?error=state_mismatch, not a 500", async () => {
    const callback = await auth.handler(
      new Request(`${BASE}/api/auth/callback/osu?code=abc&state=forged`),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe(`${BASE}/signin?error=state_mismatch`);
  });

  it("never lets a client change its identity", async () => {
    const user = await createTestUser(auth, 5);
    const response = await auth.handler(
      authRequest("update-user", user.cookie, "POST", { username: "someone-else" }),
    );
    expect(response.status).toBe(404);
    expect((await db().collection("user").findOne({ osuId: 5 }))?.username).toBe("player5");
  });
});

describe("getOsuUser", () => {
  it("reads the caller, or null without a session", async () => {
    const user = await createTestUser(auth, 5, "peppy");
    expect(await getOsuUser(auth, new Headers({ cookie: user.cookie }))).toEqual({
      id: user.id,
      osuId: 5,
      username: "peppy",
      avatarUrl: null,
    });
    expect(await getOsuUser(auth, new Headers())).toBeNull();
    const forged = new Headers({ cookie: "better-auth.session_token=forged.sig" });
    expect(await getOsuUser(auth, forged)).toBeNull();
  });
});
