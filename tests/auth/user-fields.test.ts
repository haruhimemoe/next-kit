/**
 * @file tests/auth/user-fields.test.ts
 * @desc createOsuAuth's userFields: packs' `system` field (input: false, so no client or osu!
 *       profile can set it) comes back on the session's user, typed, so a session that reaches
 *       a system account anyway reads as one (packs' "reads as signed out" case).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { createOsuAuth } from "../../src/auth/index.js";
import { TEST_OSU_APP_ENV } from "../../src/testing/index.js";
import { BASE, MARKER, SECRET, sessionCookie } from "../helpers/auth.js";
import { testDatabase } from "../helpers/db.js";

const { client, db } = testDatabase("auth-fields");
const auth = createOsuAuth({
  clientId: TEST_OSU_APP_ENV.OSU_CLIENT_ID,
  clientSecret: TEST_OSU_APP_ENV.OSU_CLIENT_SECRET,
  baseURL: BASE,
  secret: SECRET,
  db: db(),
  client,
  markerCookie: MARKER,
  userFields: { system: { type: "boolean", required: false, input: false } },
});

const sessionFor = async (userId: ObjectId): Promise<Headers> => {
  const token = new ObjectId().toHexString();
  const now = new Date();
  await db()
    .collection("session")
    .insertOne({
      userId,
      token,
      expiresAt: new Date(now.getTime() + 3_600_000),
      createdAt: now,
      updatedAt: now,
    });
  return new Headers({ cookie: await sessionCookie(token) });
};

describe("userFields", () => {
  it("returns the app's own field on the session's user, typed", async () => {
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
    const session = await auth.api.getSession({ headers: await sessionFor(insertedId) });
    const system: boolean | null | undefined = session?.user.system;
    expect(system).toBe(true);
    expect(session?.user.osuId).toBe(0);
  });
});
