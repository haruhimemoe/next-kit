/**
 * @file tests/inbox/routes.test.ts
 * @desc matchApp, createInboxRoutes and createInboxClient: the bearer picks the app, a body that
 *       claims an app is refused, another app's invite id is a 409, a short secret counts as
 *       unset, and the client round-trips through the route on the in-memory MongoDB.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { matchApp } from "../../src/inbox/auth.js";
import { createInboxClient } from "../../src/inbox/client.js";
import { createInboxRoutes } from "../../src/inbox/routes.js";
import { createInboxStore } from "../../src/inbox/store.js";
import { testDatabase } from "../helpers/db.js";

const { connectedDb } = testDatabase("inbox-routes");
const HUB = "https://www.haruhime.moe";
const apps = [
  { id: "bb", name: "bb", baseUrl: "https://bb.haruhime.moe", secretEnv: "S_BB" },
  { id: "packs", name: "packs", baseUrl: "https://packs.haruhime.moe", secretEnv: "S_PACKS" },
  { id: "pools", name: "pools", baseUrl: "https://pools.haruhime.moe", secretEnv: "S_POOLS" },
];
const env = { S_BB: "b".repeat(32), S_PACKS: "p".repeat(32), S_POOLS: "short" };
const store = createInboxStore(connectedDb);
const routes = createInboxRoutes({ store, apps, env });
const USER = new ObjectId().toHexString();
const invite = { id: "inv1", from: 1, to: 2, state: "pending", doc: {} };

const post = (body: unknown, secret: string | null = env.S_BB) =>
  routes.post(
    new Request(`${HUB}/api/internal/inbox`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

describe("matchApp", () => {
  it("names the one app whose secret matches, skipping short ones", () => {
    expect(matchApp(env.S_PACKS, apps, env)).toEqual({ app: apps[1] });
    expect(matchApp("short", apps, env)).toEqual({ app: null, configured: true });
    expect(matchApp(null, apps, env)).toEqual({ app: null, configured: true });
    expect(matchApp(env.S_BB, apps, {})).toEqual({ app: null, configured: false });
  });

  it("refuses when two apps share one secret", () => {
    expect(matchApp(env.S_BB, apps, { S_BB: env.S_BB, S_PACKS: env.S_BB })).toMatchObject({
      app: null,
    });
  });
});

describe("createInboxRoutes", () => {
  it("answers 401 without a matching secret, 503 with none configured", async () => {
    expect((await post({ op: "putInvite", invite }, null)).status).toBe(401);
    expect((await post({ op: "putInvite", invite }, "short")).status).toBe(401);
    const off = createInboxRoutes({ store, apps, env: {} });
    const res = await off.post(new Request(`${HUB}/x`, { method: "POST" }));
    expect(res.status).toBe(503);
  });

  it("stores an invite under the app the secret named", async () => {
    const res = await post({ op: "putInvite", invite });
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await store.invitesFor(2))[0]).toMatchObject({ id: "inv1", app: "bb" });
  });

  it("refuses a body that claims an app", async () => {
    expect((await post({ op: "putInvite", invite: { ...invite, app: "packs" } })).status).toBe(400);
    expect((await post({ op: "putInvite", invite, app: "packs" })).status).toBe(400);
  });

  it("answers 409 when another app holds the invite id", async () => {
    await post({ op: "putInvite", invite });
    expect((await post({ op: "putInvite", invite }, env.S_PACKS)).status).toBe(409);
  });

  it("stores a notification and refuses a protocol-relative href", async () => {
    const note = { userId: USER, kind: "invite", title: "You got an invite" };
    const res = await post({ op: "notify", notification: { ...note, href: "/inbox" } });
    expect(res.status).toBe(201);
    expect((await store.notificationsFor(USER))[0]).toMatchObject({ app: "bb", href: "/inbox" });
    const bad = await post({ op: "notify", notification: { ...note, href: "//evil.test" } });
    expect(bad.status).toBe(400);
    const slash = await post({ op: "notify", notification: { ...note, href: "/\\evil.test" } });
    expect(slash.status).toBe(400);
  });
});

describe("createInboxClient", () => {
  it("posts through the route with its secret", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      routes.post(new Request(String(input), init)),
    );
    const client = createInboxClient({
      hubUrl: HUB,
      secret: env.S_PACKS,
      fetcher: fetcher as unknown as typeof fetch,
    });
    await client.putInvite({ ...invite, expiresAt: new Date("2026-11-01T00:00:00.000Z") });
    const id = await client.notify({ userId: USER, kind: "k", title: "t" });
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect((await store.invitesFor(1))[0]).toMatchObject({
      app: "packs",
      expiresAt: new Date("2026-11-01T00:00:00.000Z"),
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(`${HUB}/api/internal/inbox`);
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe("manual");
  });

  it("throws when the hub refuses", async () => {
    const client = createInboxClient({
      hubUrl: HUB,
      secret: "wrong".repeat(8),
      fetcher: (async (input: string | URL | Request, init?: RequestInit) =>
        routes.post(new Request(String(input), init))) as typeof fetch,
    });
    await expect(client.notify({ userId: USER, kind: "k", title: "t" })).rejects.toThrow("401");
  });
});
