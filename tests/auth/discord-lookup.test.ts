/**
 * @file tests/auth/discord-lookup.test.ts
 * @desc findUserByDiscordId on the in-memory MongoDB: a linked user, nobody, a malformed id and
 *       a banned user.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { findUserByDiscordId } from "../../src/auth/discord-lookup.js";
import { testDatabase } from "../helpers/db.js";

const { db } = testDatabase("discord-lookup");

describe("findUserByDiscordId", () => {
  it("finds the linked user", async () => {
    const _id = new ObjectId();
    await db()
      .collection("user")
      .insertOne({ _id, osuId: 124493, username: "cookiezi", image: "a.png", discordId: "42" });
    expect(await findUserByDiscordId(db(), "42")).toEqual({
      id: _id.toHexString(),
      osuId: 124493,
      username: "cookiezi",
      avatarUrl: "a.png",
    });
  });

  it("is null for nobody, a malformed id, or a banned user", async () => {
    await db()
      .collection("user")
      .insertOne({ osuId: 1, username: "x", discordId: "7", bannedAt: new Date() });
    expect(await findUserByDiscordId(db(), "8")).toBeNull();
    expect(await findUserByDiscordId(db(), "7")).toBeNull();
    expect(await findUserByDiscordId(db(), { $ne: null } as unknown as string)).toBeNull();
    expect(await findUserByDiscordId(db(), "")).toBeNull();
  });

  it("gives a null avatar when there is none", async () => {
    await db().collection("user").insertOne({ osuId: 2, username: "y", discordId: "9" });
    expect((await findUserByDiscordId(db(), "9"))?.avatarUrl).toBeNull();
  });
});
