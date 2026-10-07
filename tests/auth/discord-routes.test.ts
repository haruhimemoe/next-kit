/**
 * @file tests/auth/discord-routes.test.ts
 * @desc createDiscordLinkRoutes on the in-memory MongoDB with an injected fetcher: off means
 *       404, start's session, cross-site, method and ban checks and its host-only cookie, the
 *       callback's happy path (two fields, no token), taken ids (pre-check and E11000), a
 *       hostile returnPath, Discord errors, and unlink.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DISCORD_STATE_COOKIE } from "../../src/auth/discord.js";
import { createDiscordLinkRoutes } from "../../src/auth/discord-routes.js";
import { buildIdentityIndexes } from "../../src/mongo/indexes.js";
import { testDatabase } from "../helpers/db.js";

const { db, connectedDb } = testDatabase("discord-routes");
const HUB = "https://www.haruhime.moe";
const SECRET = "s".repeat(32);
const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const config = {
  clientId: "123",
  clientSecret: "shh",
  redirectUri: `${HUB}/api/account/discord/callback`,
};
const me = new ObjectId();
const other = new ObjectId();
let signedIn: string | null = me.toHexString();
const discord = { id: "4242", username: "cookiezi" };
const fetcher = vi.fn(async (input: string | URL | Request) =>
  String(input).endsWith("/token")
    ? Response.json({ access_token: "tok", token_type: "Bearer" })
    : Response.json(discord),
);
const options = {
  config,
  identityDb: connectedDb,
  secret: SECRET,
  currentUser: async () => (signedIn ? { id: signedIn } : null),
  fetcher: fetcher as unknown as typeof fetch,
  now: () => NOW,
};
const routes = createDiscordLinkRoutes(options);
const users = () => db().collection("user");

const post = (path: string, headers: Record<string, string> = {}) =>
  new Request(`${HUB}${path}`, { method: "POST", headers });
const startCookie = async () => {
  const response = await routes.start(post("/api/account/discord/start"));
  const location = new URL(response.headers.get("location") ?? "");
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  return { response, state: location.searchParams.get("state") ?? "", cookie };
};
const callback = async (query?: string) => {
  const { state, cookie } = await startCookie();
  return routes.callback(
    new Request(`${HUB}/api/account/discord/callback?${query ?? `code=abc&state=${state}`}`, {
      headers: { cookie },
    }),
  );
};
const outcome = (response: Response) =>
  new URL(response.headers.get("location") ?? "").searchParams.get("discord");

beforeEach(async () => {
  signedIn = me.toHexString();
  fetcher.mockClear();
  await buildIdentityIndexes(db());
  await users().insertMany([
    { _id: me, osuId: 1, username: "me" },
    { _id: other, osuId: 2, username: "other" },
  ]);
});

describe("off", () => {
  it("answers 404 on every route when config is null", async () => {
    const off = createDiscordLinkRoutes({ ...options, config: null });
    expect((await off.start(post("/s"))).status).toBe(404);
    expect((await off.callback(new Request(`${HUB}/c`))).status).toBe(404);
    expect((await off.unlink(post("/u"))).status).toBe(404);
  });
});

describe("start", () => {
  it("sets a host-only, path-scoped state cookie and goes to Discord", async () => {
    const { response, state } = await startCookie();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(
      /^https:\/\/discord\.com\/oauth2\/authorize\?/,
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${DISCORD_STATE_COOKIE}=${state}.`);
    expect(cookie).toContain("Path=/api/account/discord");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie.toLowerCase()).not.toContain("domain");
  });

  it("sends a signed-out user to sign-in", async () => {
    signedIn = null;
    const response = await routes.start(post("/api/account/discord/start"));
    expect(response.headers.get("location")).toBe(`${HUB}/signin?next=%2Faccount`);
  });

  it("refuses GET and cross-site starts", async () => {
    const get = new Request(`${HUB}/api/account/discord/start`);
    expect((await routes.start(get)).status).toBe(405);
    const foreign = post("/api/account/discord/start", { origin: "https://evil.example" });
    expect((await routes.start(foreign)).status).toBe(403);
  });

  it("refuses a banned user", async () => {
    await users().updateOne({ _id: me }, { $set: { bannedAt: new Date() } });
    const response = await routes.start(post("/api/account/discord/start"));
    expect(outcome(response)).toBe("error");
    expect(response.headers.get("location")).not.toContain("discord.com");
  });
});

describe("callback", () => {
  it("writes the two fields, stores no token, and clears the cookie", async () => {
    const response = await callback();
    expect(outcome(response)).toBe("linked");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    const doc = await users().findOne({ _id: me });
    expect(doc).toMatchObject({ discordId: "4242", discordUsername: "cookiezi" });
    expect(JSON.stringify(doc)).not.toContain("tok");
    expect(await db().collection("account").countDocuments()).toBe(0);
  });

  it("refuses a Discord id another user holds, writing nothing", async () => {
    await users().updateOne({ _id: other }, { $set: { discordId: "4242" } });
    expect(outcome(await callback())).toBe("taken");
    expect((await users().findOne({ _id: me }))?.discordId).toBeUndefined();
  });

  it("maps a duplicate-key error on the write to taken (the race)", async () => {
    const real = await connectedDb();
    const racing = {
      collection: (name: string) => {
        const target = real.collection(name);
        return Object.assign(Object.create(target), {
          updateOne: async () => {
            throw Object.assign(new Error("E11000"), { code: 11000 });
          },
        });
      },
    } as unknown as Db;
    const raced = createDiscordLinkRoutes({ ...options, identityDb: async () => racing });
    const { state, cookie } = await startCookie();
    const response = await raced.callback(
      new Request(`${HUB}/api/account/discord/callback?code=abc&state=${state}`, {
        headers: { cookie },
      }),
    );
    expect(outcome(response)).toBe("taken");
  });

  it("gives error on a Discord 4xx, a bad profile, or a thrown fetch", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 400 }));
    expect(outcome(await callback())).toBe("error");
    fetcher.mockResolvedValueOnce(Response.json({}));
    expect(outcome(await callback())).toBe("error");
    fetcher
      .mockResolvedValueOnce(Response.json({ access_token: "tok" }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));
    expect(outcome(await callback())).toBe("error");
    fetcher
      .mockResolvedValueOnce(Response.json({ access_token: "tok" }))
      .mockResolvedValueOnce(Response.json({ id: "not-a-snowflake", username: "x" }));
    expect(outcome(await callback())).toBe("error");
    fetcher.mockRejectedValueOnce(new Error("network"));
    expect(outcome(await callback())).toBe("error");
    expect((await users().findOne({ _id: me }))?.discordId).toBeUndefined();
    quiet.mockRestore();
  });

  it("refuses a bad state, no code, or another signed-in user", async () => {
    expect(outcome(await callback("code=abc&state=nope"))).toBe("error");
    expect(outcome(await callback("state=x"))).toBe("error");
    const { state, cookie } = await startCookie();
    signedIn = other.toHexString();
    const response = await routes.callback(
      new Request(`${HUB}/api/account/discord/callback?code=abc&state=${state}`, {
        headers: { cookie },
      }),
    );
    expect(outcome(response)).toBe("error");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("lands on the configured path and ignores query redirects", async () => {
    const custom = createDiscordLinkRoutes({ ...options, returnPath: "/me" });
    const response = await custom.callback(
      new Request(`${HUB}/api/account/discord/callback?next=https://evil.example`),
    );
    expect(response.headers.get("location")).toBe(`${HUB}/me?discord=error`);
  });
});

describe("returnPath", () => {
  it("refuses a hostile returnPath at construction", () => {
    for (const returnPath of ["https://evil.example", "//evil.example", "/\\evil", "account"]) {
      expect(() => createDiscordLinkRoutes({ ...options, returnPath })).toThrow(TypeError);
    }
  });
});

describe("unlink", () => {
  it("clears the fields with a 204", async () => {
    await users().updateOne({ _id: me }, { $set: { discordId: "4242", discordUsername: "c" } });
    const response = await routes.unlink(post("/api/account/discord"));
    expect(response.status).toBe(204);
    const doc = await users().findOne({ _id: me });
    expect(doc?.discordId).toBeUndefined();
    expect(doc?.discordUsername).toBeUndefined();
  });

  it("refuses a GET unlink", async () => {
    const get = new Request(`${HUB}/api/account/discord`);
    expect((await routes.unlink(get)).status).toBe(405);
  });

  it("refuses cross-site and signed-out unlinks", async () => {
    const foreign = post("/api/account/discord", { "sec-fetch-site": "cross-site" });
    expect((await routes.unlink(foreign)).status).toBe(403);
    signedIn = null;
    expect((await routes.unlink(post("/api/account/discord"))).status).toBe(401);
  });
});
