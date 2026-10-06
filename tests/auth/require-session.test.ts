/**
 * @file tests/auth/require-session.test.ts
 * @desc getSessionUser, requireSession and requireAdmin over both session sources (the hub's
 *       better-auth instance and a satellite's createSessionReader), and the bannedAt field on
 *       OsuSessionUser/OsuSession (identity spec section 3, plan step 5): a banned user is
 *       returned by getSessionUser/getOsuUser but refused by requireSession and requireAdmin.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import {
  createSessionReader,
  getOsuUser,
  getSessionUser,
  requireAdmin,
  requireSession,
} from "../../src/auth/index.js";
import { setupMsw } from "../../src/testing/index.js";
import { createTestUser, makeAuth, OSU_HANDLERS, SECRET } from "../helpers/auth.js";
import { testDatabase } from "../helpers/db.js";

setupMsw(...OSU_HANDLERS);
const { client, db } = testDatabase("auth-require-session");
const hub = makeAuth(db(), client);
const satellite = createSessionReader({
  identityDb: db(),
  secret: SECRET,
  hubUrl: "https://haruhime.moe",
});

const ban = async (osuId: number) =>
  db()
    .collection("user")
    .updateOne({ osuId }, { $set: { bannedAt: new Date("2026-02-02"), banReason: "spam" } });

describe.each([
  ["the hub", hub],
  ["a satellite", satellite],
])("getSessionUser, requireSession and requireAdmin over %s", (_label, source) => {
  it("returns the signed-in user", async () => {
    const user = await createTestUser(hub, 60, "regular");
    expect(await getSessionUser(source, new Headers({ cookie: user.cookie }))).toMatchObject({
      osuId: 60,
      username: "regular",
    });
    expect(await requireSession(source, new Headers({ cookie: user.cookie }))).toMatchObject({
      osuId: 60,
    });
  });

  it("returns null without a session", async () => {
    expect(await getSessionUser(source, new Headers())).toBeNull();
    expect(await requireSession(source, new Headers())).toBeNull();
  });

  it("getSessionUser still returns a banned user; requireSession refuses them", async () => {
    const user = await createTestUser(hub, 61, "bad-actor");
    await ban(61);
    const seen = await getSessionUser(source, new Headers({ cookie: user.cookie }));
    expect(seen?.bannedAt).toEqual(new Date("2026-02-02"));
    expect(await requireSession(source, new Headers({ cookie: user.cookie }))).toBeNull();
  });

  it("requireAdmin needs both an unbanned session and the admin allowlist", async () => {
    const admin = await createTestUser(hub, 62, "boss");
    const nobody = await createTestUser(hub, 63, "rando");
    const headersFor = (cookie: string) => new Headers({ cookie });
    expect(await requireAdmin(source, headersFor(admin.cookie), [62])).toMatchObject({
      osuId: 62,
    });
    expect(await requireAdmin(source, headersFor(nobody.cookie), [62])).toBeNull();
    expect(await requireAdmin(source, headersFor(admin.cookie), new Set([99]))).toBeNull();
    await ban(62);
    expect(await requireAdmin(source, headersFor(admin.cookie), [62])).toBeNull();
  });
});

describe("getOsuUser also carries bannedAt now", () => {
  it("returns the banned user rather than refusing them", async () => {
    const user = await createTestUser(hub, 64, "also-banned");
    await ban(64);
    expect(await getOsuUser(hub, new Headers({ cookie: user.cookie }))).toMatchObject({
      osuId: 64,
      bannedAt: new Date("2026-02-02"),
    });
  });
});
