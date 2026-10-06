/**
 * @file tests/auth/session-reader.test.ts
 * @desc createSessionReader (identity spec section 2, plan step 4): a valid cookie, an expired
 *       session, a banned user (still returned, with bannedAt set), a wrong secret, a
 *       refresh-eligible read that makes no write, and the fire-and-forget refresh ping to the
 *       hub. The session itself is made straight through better-auth's adapter (makeAuth +
 *       createTestUser), then read raw by the reader, never through betterAuth() itself.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { createSessionReader, SESSION_UPDATE_AGE_SECONDS } from "../../src/auth/index.js";
import { setupMsw } from "../../src/testing/index.js";
import { createTestUser, makeAuth, OSU_HANDLERS, SECRET } from "../helpers/auth.js";
import { testDatabase } from "../helpers/db.js";

setupMsw(...OSU_HANDLERS);
const { client, db } = testDatabase("auth-session-reader");
const auth = makeAuth(db(), client);

const reader = (overrides: Partial<Parameters<typeof createSessionReader>[0]> = {}) =>
  createSessionReader({
    identityDb: db(),
    secret: SECRET,
    hubUrl: "https://haruhime.moe",
    ...overrides,
  });

const ageSession = async (userId: string, updatedAt: Date, expiresAt?: Date) => {
  await db()
    .collection("session")
    .updateOne(
      { userId: new ObjectId(userId) },
      { $set: { updatedAt, ...(expiresAt ? { expiresAt } : {}) } },
    );
};

describe("createSessionReader", () => {
  it("reads a valid cookie: the user, osu! fields and the session", async () => {
    const user = await createTestUser(auth, 50, "cookiekid");
    const result = await reader().getSession(new Headers({ cookie: user.cookie }));
    expect(result).toMatchObject({
      user: { id: user.id, osuId: 50, username: "cookiekid", bannedAt: null, banReason: null },
    });
    expect(result?.session.expiresAt).toBeInstanceOf(Date);
  });

  it("returns null without a cookie, or with no session for the token", async () => {
    expect(await reader().getSession(new Headers())).toBeNull();
    const forged = `better-auth.session_token=${encodeURIComponent("nope.c2lnbmF0dXJl")}`;
    expect(await reader().getSession(new Headers({ cookie: forged }))).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const user = await createTestUser(auth, 51);
    await ageSession(user.id, new Date(), new Date(Date.now() - 1000));
    expect(await reader().getSession(new Headers({ cookie: user.cookie }))).toBeNull();
  });

  it("still returns a banned user, with bannedAt set", async () => {
    const user = await createTestUser(auth, 52);
    await db()
      .collection("user")
      .updateOne({ osuId: 52 }, { $set: { bannedAt: new Date("2026-01-01"), banReason: "spam" } });
    const result = await reader().getSession(new Headers({ cookie: user.cookie }));
    expect(result?.user.bannedAt).toEqual(new Date("2026-01-01"));
    expect(result?.user.banReason).toBe("spam");
  });

  it("returns null for the right token signed with the wrong secret", async () => {
    const user = await createTestUser(auth, 53);
    const wrong = reader({ secret: "a-different-secret-entirely" });
    expect(await wrong.getSession(new Headers({ cookie: user.cookie }))).toBeNull();
  });

  it("makes no write on a refresh-eligible read", async () => {
    const user = await createTestUser(auth, 54);
    const old = new Date(Date.now() - (SESSION_UPDATE_AGE_SECONDS + 3600) * 1000);
    await ageSession(user.id, old);
    const before = await db().collection("session").findOne({ userId: new ObjectId(user.id) });
    const fetchImpl = vi.fn(async () => new Response(null));
    await reader({ fetchImpl }).getSession(new Headers({ cookie: user.cookie }));
    const after = await db().collection("session").findOne({ userId: new ObjectId(user.id) });
    expect(after).toEqual(before);
  });

  it("pings the hub's get-session, fire-and-forget, when the session is refresh-eligible", async () => {
    const user = await createTestUser(auth, 55);
    const old = new Date(Date.now() - (SESSION_UPDATE_AGE_SECONDS + 3600) * 1000);
    await ageSession(user.id, old);
    const fetchImpl = vi.fn(async () => new Response(null));
    const result = await reader({ fetchImpl }).getSession(new Headers({ cookie: user.cookie }));
    expect(result).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      { headers: { cookie: string } },
    ];
    expect(url.toString()).toBe("https://haruhime.moe/api/auth/get-session");
    expect(init.headers.cookie).toBe(user.cookie);
  });

  it("never pings the hub for a fresh session", async () => {
    const user = await createTestUser(auth, 56);
    const fetchImpl = vi.fn(async () => new Response(null));
    await reader({ fetchImpl }).getSession(new Headers({ cookie: user.cookie }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("doesn't fail the read when the refresh ping itself fails", async () => {
    const user = await createTestUser(auth, 57);
    const old = new Date(Date.now() - (SESSION_UPDATE_AGE_SECONDS + 3600) * 1000);
    await ageSession(user.id, old);
    const fetchImpl = vi.fn(async () => {
      throw new Error("hub unreachable");
    });
    const result = await reader({ fetchImpl }).getSession(new Headers({ cookie: user.cookie }));
    expect(result).not.toBeNull();
  });
});
