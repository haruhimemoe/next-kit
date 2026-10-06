/**
 * @file tests/auth/hub.test.ts
 * @desc createOsuAuth's hub-only options (identity spec section 2, plan step 3): cookieDomain
 *       puts the session cookie, the signed-in marker and OAuth state/PKCE cookies on the
 *       parent domain, trustedOrigins reaches better-auth, and the session is 30 days with a
 *       1-day updateAge. A single-DB app that never passes cookieDomain is unaffected.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { SESSION_EXPIRES_IN_SECONDS, SESSION_UPDATE_AGE_SECONDS } from "../../src/auth/index.js";
import { setupMsw } from "../../src/testing/index.js";
import {
  cookiesFrom,
  MARKER,
  makeAuth,
  OSU_HANDLERS,
  PROFILE,
  signInWithOsu,
} from "../helpers/auth.js";
import { testDatabase } from "../helpers/db.js";

setupMsw(...OSU_HANDLERS);
const { client, db } = testDatabase("auth-hub");

const HUB_BASE = "https://haruhime.moe";
const COOKIE_DOMAIN = ".haruhime.moe";

const hub = makeAuth(
  db(),
  client,
  {},
  {
    baseURL: HUB_BASE,
    cookieDomain: COOKIE_DOMAIN,
    trustedOrigins: ["https://pools.haruhime.moe", "https://packs.haruhime.moe"],
  },
);

describe("createOsuAuth with cookieDomain", () => {
  it("puts the session cookie on the parent domain, Secure", async () => {
    const callback = await signInWithOsu(hub, PROFILE(41), HUB_BASE);
    const sessionCookie = callback.headers
      .getSetCookie()
      .find((cookie) => cookie.includes("session_token="));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(new RegExp(`Domain=${COOKIE_DOMAIN.replace(".", "\\.")}`, "i"));
    expect(sessionCookie).toMatch(/Secure/i);
  });

  it("puts the OAuth state cookie on the parent domain too", async () => {
    const start = await hub.handler(
      new Request(`${HUB_BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { origin: HUB_BASE, "content-type": "application/json" },
        body: JSON.stringify({ provider: "osu", callbackURL: "/admin" }),
      }),
    );
    const stateCookie = start.headers.getSetCookie().find((cookie) => cookie.includes("state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie).toMatch(new RegExp(`Domain=${COOKIE_DOMAIN.replace(".", "\\.")}`, "i"));
  });

  it("puts the signed-in marker on the parent domain", async () => {
    const callback = await signInWithOsu(hub, PROFILE(42), HUB_BASE);
    const marker = callback.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith(`${MARKER}=`));
    expect(marker).toMatch(new RegExp(`Domain=${COOKIE_DOMAIN.replace(".", "\\.")}`, "i"));
  });

  it("signs a 30-day session with a 1-day updateAge", async () => {
    expect(SESSION_EXPIRES_IN_SECONDS).toBe(60 * 60 * 24 * 30);
    expect(SESSION_UPDATE_AGE_SECONDS).toBe(60 * 60 * 24);
    const callback = await signInWithOsu(hub, PROFILE(43), HUB_BASE);
    const headers = new Headers({ cookie: cookiesFrom(callback) });
    const session = await hub.api.getSession({ headers });
    const expiresAt = new Date(
      (session as { session: { expiresAt: Date | string } }).session.expiresAt,
    );
    const days = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
  });
});

describe("createOsuAuth without cookieDomain (single-DB apps unaffected)", () => {
  it("keeps the session cookie host-only, no Domain attribute", async () => {
    const solo = makeAuth(db(), client);
    const callback = await signInWithOsu(solo, PROFILE(44));
    const sessionCookie = callback.headers
      .getSetCookie()
      .find((cookie) => cookie.includes("session_token="));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).not.toMatch(/Domain=/i);
  });
});
