/**
 * @file tests/auth/osu.test.ts
 * @desc The osu! pieces and better-auth's indexes: the profile mapping, dropped tokens, the
 *       provider config, toSessionUser, and pools' index cases (tests/integration/lib/
 *       db-indexes.test.ts: every index built, and each unique one holds).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  AUTH_INDEX_SPECS,
  AUTH_INDEXES,
  IDENTITY_USER_FIELDS,
  OSU_PROVIDER_ID,
  osuProfileToUser,
  osuProvider,
  toSessionUser,
  withoutTokens,
} from "../../src/auth/index.js";
import { ensureIndexes } from "../../src/mongo/index.js";
import { testDatabase } from "../helpers/db.js";

const { db } = testDatabase("auth-osu");

describe("osuProfileToUser", () => {
  it("maps the profile with a synthetic email and the avatar as image", () => {
    const raw = { id: 2, username: "peppy", avatar_url: "https://a.ppy.sh/2", country_code: "AU" };
    expect(osuProfileToUser(raw)).toEqual({
      email: "2@osu.local",
      emailVerified: false,
      name: "peppy",
      osuId: 2,
      username: "peppy",
      avatarUrl: "https://a.ppy.sh/2",
      countryCode: "AU",
      image: "https://a.ppy.sh/2",
    });
  });

  it("leaves image out, not null, without an avatar", () => {
    expect("image" in osuProfileToUser({ id: 3, username: "x" })).toBe(false);
  });

  it("refuses a profile with no id or username", () => {
    expect(() => osuProfileToUser({ username: "x" })).toThrow();
    expect(() => osuProfileToUser({ id: 1 })).toThrow();
  });
});

describe("withoutTokens and osuProvider", () => {
  it("drops every OAuth token and keeps the rest", () => {
    const account = { userId: "u", accessToken: "a", refreshToken: "r", idToken: "i" };
    expect(withoutTokens(account)).toEqual({
      userId: "u",
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
  });

  it("asks osu! for identify and public, with PKCE, refreshing the profile", () => {
    const provider = osuProvider({ clientId: "1", clientSecret: "s" });
    expect(provider).toMatchObject({
      providerId: OSU_PROVIDER_ID,
      clientId: "1",
      clientSecret: "s",
      authorizationUrl: "https://osu.ppy.sh/oauth/authorize",
      tokenUrl: "https://osu.ppy.sh/oauth/token",
      userInfoUrl: "https://osu.ppy.sh/api/v2/me",
      scopes: ["identify", "public"],
      pkce: true,
      overrideUserInfo: true,
    });
    expect(provider.mapProfileToUser).toBe(osuProfileToUser);
  });

  it("reads a session's user, with null for no avatar", () => {
    expect(toSessionUser({ user: { id: "u", osuId: 2, username: "peppy" } })).toEqual({
      id: "u",
      osuId: 2,
      username: "peppy",
      avatarUrl: null,
    });
  });
});

describe("AUTH_INDEX_SPECS", () => {
  const indexNamed = async (collection: string, name: string) =>
    (await db().collection(collection).indexes()).find((index) => index.name === name);

  it("builds every index", async () => {
    expect((await ensureIndexes(db(), AUTH_INDEX_SPECS)).skipped).toEqual([]);
    expect(await indexNamed("user", AUTH_INDEXES.userOsuId)).toMatchObject({
      key: { osuId: 1 },
      unique: true,
    });
    expect(await indexNamed("account", AUTH_INDEXES.accountKey)).toMatchObject({
      key: { providerId: 1, accountId: 1 },
      unique: true,
    });
    expect(await indexNamed("session", AUTH_INDEXES.sessionToken)).toMatchObject({
      key: { token: 1 },
      unique: true,
    });
    const byUser = await indexNamed("session", AUTH_INDEXES.sessionUser);
    expect(byUser?.key).toEqual({ userId: 1 });
    expect(byUser?.unique).toBeUndefined();
    expect(await indexNamed("session", AUTH_INDEXES.sessionTtl)).toMatchObject({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    expect(Object.isFrozen(AUTH_INDEX_SPECS)).toBe(true);
  });

  it("holds: a second user, link or session token for the same key is refused", async () => {
    await ensureIndexes(db(), AUTH_INDEX_SPECS);
    const duplicate = { code: 11000 };
    await db().collection("user").insertOne({ osuId: 5 });
    await expect(db().collection("user").insertOne({ osuId: 5 })).rejects.toMatchObject(duplicate);
    const link = { providerId: "osu", accountId: "5" };
    await db()
      .collection("account")
      .insertOne({ ...link, userId: new ObjectId() });
    await expect(
      db()
        .collection("account")
        .insertOne({ ...link, userId: new ObjectId() }),
    ).rejects.toMatchObject(duplicate);
    await db().collection("session").insertOne({ token: "t", userId: new ObjectId() });
    await expect(
      db().collection("session").insertOne({ token: "t", userId: new ObjectId() }),
    ).rejects.toMatchObject(duplicate);
  });
});

describe("IDENTITY_USER_FIELDS", () => {
  it("is every identity field from section 3 of the spec, none client-settable", () => {
    expect(Object.keys(IDENTITY_USER_FIELDS)).toEqual([
      "locale",
      "notificationPrefs",
      "bannedAt",
      "banReason",
      "limits",
      "discordId",
      "discordUsername",
    ]);
    expect(Object.values(IDENTITY_USER_FIELDS).every((field) => field.input === false)).toBe(
      true,
    );
    expect(IDENTITY_USER_FIELDS.bannedAt.type).toBe("date");
  });
});
