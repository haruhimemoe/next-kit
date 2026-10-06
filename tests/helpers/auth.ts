/**
 * @file tests/helpers/auth.ts
 * @desc An osu! better-auth instance on the run's in-memory MongoDB, the osu! endpoints mocked
 *       with msw, a full sign-in (sign-in/social then the callback, as a browser would), and
 *       users with sessions made straight through better-auth's adapter. After packs' and
 *       pools' tests/helpers/auth.ts and their sign-in helpers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { makeSignature } from "better-auth/crypto";
import type { Db, MongoClient } from "mongodb";
import { HttpResponse, http } from "msw";
import { expect } from "vitest";
import { createOsuAuth, OSU_PROVIDER_ID, type OsuAuthHooks } from "../../src/auth/index.js";
import { TEST_OSU_APP_ENV } from "../../src/testing/env.js";

export const BASE = "http://localhost:3000";
export const SECRET = TEST_OSU_APP_ENV.BETTER_AUTH_SECRET;
export const MARKER = "kit-signed-in";

/** osu!'s token and /me endpoints; set `profile` to the profile /me returns. */
export const osu = { profile: {} as Record<string, unknown> };
export const OSU_HANDLERS = [
  http.post("https://osu.ppy.sh/oauth/token", () =>
    HttpResponse.json({
      access_token: "a",
      refresh_token: "r",
      token_type: "Bearer",
      expires_in: 86400,
    }),
  ),
  http.get("https://osu.ppy.sh/api/v2/me", () => HttpResponse.json(osu.profile)),
];

/** A /me profile for an osu! id. */
export const PROFILE = (id: number) => ({
  id,
  username: `player${id}`,
  avatar_url: `https://a.ppy.sh/${id}`,
  country_code: "AU",
  country: { code: "AU" },
});

/** makeAuth's hub-only overrides: cookieDomain and trustedOrigins for the identity tests, or a
 * different baseURL to go with them. Spelled out rather than lifted from createOsuAuth's own
 * (generic) parameter type, which widens createOsuAuth's return type for every caller. */
export type MakeAuthOverrides = {
  baseURL?: string;
  cookieDomain?: string;
  trustedOrigins?: string[];
};

/**
 * @function makeAuth
 * @param db {Db} the test database
 * @param client {MongoClient} its client
 * @param hooks {OsuAuthHooks} the app's hooks
 * @param overrides {MakeAuthOverrides} hub-only extras (cookieDomain, trustedOrigins, baseURL)
 * @returns an osu! better-auth instance on that database
 */
export const makeAuth = (
  db: Db,
  client: MongoClient,
  hooks: OsuAuthHooks = {},
  overrides: MakeAuthOverrides = {},
) =>
  createOsuAuth({
    clientId: TEST_OSU_APP_ENV.OSU_CLIENT_ID,
    clientSecret: TEST_OSU_APP_ENV.OSU_CLIENT_SECRET,
    baseURL: BASE,
    secret: SECRET,
    db,
    client,
    markerCookie: MARKER,
    hooks,
    ...overrides,
  });

type Auth = ReturnType<typeof makeAuth>;

/** Every Set-Cookie of a response as one Cookie header. */
export const cookiesFrom = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

/** A request to better-auth's API, against `base` (default BASE). */
export const authRequest = (
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
  base: string = BASE,
) =>
  new Request(`${base}/api/auth/${path}`, {
    method,
    headers: { cookie, origin: base, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/**
 * @function signInWithOsu
 * @param auth {Auth} the instance
 * @param profile {Record<string, unknown>} what osu!'s /me returns
 * @param base {string} the instance's own baseURL (default BASE; pass the hub's own baseURL
 *        when the instance was built with a different one)
 * @returns {Promise<Response>} the callback's answer (a redirect with the session cookies)
 */
export const signInWithOsu = async (
  auth: Auth,
  profile: Record<string, unknown>,
  base: string = BASE,
): Promise<Response> => {
  const start = await auth.handler(
    authRequest(
      "sign-in/social",
      "",
      "POST",
      { provider: OSU_PROVIDER_ID, callbackURL: "/admin", errorCallbackURL: "/signin?next=%2Fadmin" },
      base,
    ),
  );
  const { url } = (await start.json()) as { url: string };
  const target = new URL(url);
  expect(target.searchParams.get("code_challenge_method")).toBe("S256");
  expect(target.searchParams.get("redirect_uri")).toBe(`${base}/api/auth/callback/osu`);
  osu.profile = profile;
  const state = target.searchParams.get("state") ?? "";
  return auth.handler(
    new Request(`${base}/api/auth/callback/osu?code=abc&state=${state}`, {
      headers: { cookie: cookiesFrom(start) },
    }),
  );
};

/** A user made through the adapter, with a signed session cookie. */
export type TestUser = { id: string; osuId: number; username: string; cookie: string };

/**
 * @function sessionCookie
 * @param token {string} a session token
 * @returns {Promise<string>} the signed better-auth session cookie for it
 */
export const sessionCookie = async (token: string): Promise<string> =>
  `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, SECRET)}`)}`;

/**
 * @function createTestUser
 * @param auth {Auth} the instance
 * @param osuId {number} the user's osu! id
 * @param username {string} their osu! username (default player<osuId>)
 * @returns {Promise<TestUser>} the user's id, osu! id, username and session cookie
 */
export const createTestUser = async (
  auth: Auth,
  osuId: number,
  username = `player${osuId}`,
): Promise<TestUser> => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    {
      email: `${osuId}@osu.local`,
      emailVerified: false,
      name: username,
      osuId,
      username,
    },
    { method: "oauth", oauth: { providerId: OSU_PROVIDER_ID } },
  );
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: OSU_PROVIDER_ID,
    accountId: String(osuId),
  });
  const session = await ctx.internalAdapter.createSession(user.id, false);
  return { id: user.id, osuId, username, cookie: await sessionCookie(session.token) };
};
