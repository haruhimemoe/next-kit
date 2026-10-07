/**
 * @file src/auth/discord-routes.ts
 * @desc createDiscordLinkRoutes (0.13): the hub's Discord link. POST start (behind
 *       refuseCrossSite, so a third-party page can't trigger a silent prompt=none link), GET
 *       callback, POST unlink. Writes only discordId and discordUsername on identity.user: no
 *       account row, no token stored. The partial unique index is the real guard against two
 *       users holding one Discord id; a duplicate-key error maps to ?discord=taken. returnPath is
 *       checked once here, and no query value ever feeds a redirect. Every handler answers 404
 *       while config is null. Callers wrap start and callback with their rate limit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { type Db, ObjectId } from "mongodb";
import { isDuplicateKeyError } from "../mongo/duplicate.js";
import { refuseCrossSite } from "../server/cross-site.js";
import { jsonError } from "../server/errors.js";
import { safeNextPath } from "../server/safe-next.js";
import {
  DISCORD_STATE_COOKIE,
  DISCORD_STATE_PATH,
  DISCORD_STATE_TTL_SECONDS,
  type DiscordLinkConfig,
  discordAuthorizeUrl,
  newDiscordState,
  readCookie,
  signDiscordState,
  verifyDiscordState,
} from "./discord.js";

/** createDiscordLinkRoutes' options. */
export type DiscordLinkRoutesOptions = {
  config: DiscordLinkConfig | null;
  identityDb: () => Promise<Db>;
  /** BETTER_AUTH_SECRET: signs the state cookie. */
  secret: string;
  /** The hub's getSessionUser. */
  currentUser: (req: Request) => Promise<{ id: string } | null>;
  /** Where the callback lands, a same-site path (default "/account"). */
  returnPath?: string;
  /** The hub's name, for refuseCrossSite's 403 (default "haruhime.moe"). */
  siteTitle?: string;
  fetcher?: typeof fetch;
  now?: () => number;
};

/** What a callback reports in ?discord=. */
export type DiscordLinkOutcome = "linked" | "taken" | "error";

const TOKEN_URL = "https://discord.com/api/oauth2/token";
const ME_URL = "https://discord.com/api/users/@me";
const DISCORD_ID = /^\d{1,20}$/;
const cookieAttributes = `Path=${DISCORD_STATE_PATH}; HttpOnly; Secure; SameSite=Lax`;
const CLEAR_COOKIE = `${DISCORD_STATE_COOKIE}=; Max-Age=0; ${cookieAttributes}`;

const redirect = (location: string, cookie?: string): Response => {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
};

/**
 * @function createDiscordLinkRoutes
 * @param options {DiscordLinkRoutesOptions} config, identity database, secret, session lookup,
 *        landing path and test seams
 * @returns {{ start; callback; unlink }} the three route handlers
 * @throws {TypeError} when returnPath isn't a same-site path
 */
export const createDiscordLinkRoutes = ({
  config,
  identityDb,
  secret,
  currentUser,
  returnPath = "/account",
  siteTitle = "haruhime.moe",
  fetcher = (input, init) => fetch(input, init),
  now = () => Date.now(),
}: DiscordLinkRoutesOptions) => {
  if (safeNextPath(returnPath, { fallback: "" }) !== returnPath) {
    throw new TypeError("createDiscordLinkRoutes: returnPath must be a same-site path");
  }
  const notFound = () => jsonError(404, "Not found.");
  const users = async () => (await identityDb()).collection("user");
  const crossSite = (req: Request, c: DiscordLinkConfig) =>
    refuseCrossSite(req, { siteUrl: c.redirectUri, siteTitle });
  /** The signed-in user, only when they exist in identity and aren't banned. */
  const activeUser = async (req: Request): Promise<ObjectId | null> => {
    const user = await currentUser(req);
    if (!user || !ObjectId.isValid(user.id)) return null;
    const _id = new ObjectId(user.id);
    const doc = await (await users()).findOne({ _id }, { projection: { bannedAt: 1 } });
    return doc && !doc.bannedAt ? _id : null;
  };
  const land = (req: Request, outcome: DiscordLinkOutcome) => {
    const url = new URL(returnPath, req.url);
    url.searchParams.set("discord", outcome);
    return redirect(url.href, CLEAR_COOKIE);
  };

  const start = async (req: Request): Promise<Response> => {
    if (!config) return notFound();
    if (req.method !== "POST") return jsonError(405, "Use POST.");
    const refused = crossSite(req, config);
    if (refused) return refused;
    const user = await currentUser(req);
    if (!user) {
      return redirect(new URL(`/signin?next=${encodeURIComponent(returnPath)}`, req.url).href);
    }
    const userId = await activeUser(req);
    if (!userId) return land(req, "error");
    const state = newDiscordState();
    const value = signDiscordState(secret, state, userId.toHexString(), now());
    const cookie = `${DISCORD_STATE_COOKIE}=${value}; Max-Age=${DISCORD_STATE_TTL_SECONDS}; ${cookieAttributes}`;
    return redirect(discordAuthorizeUrl(config, state), cookie);
  };

  const fetchDiscordUser = async (c: DiscordLinkConfig, code: string) => {
    const tokenResponse = await fetcher(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: c.redirectUri,
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }),
    });
    if (!tokenResponse.ok) return null;
    const { access_token: token } = (await tokenResponse.json()) as { access_token?: unknown };
    if (typeof token !== "string") return null;
    const me = await fetcher(ME_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (!me.ok) return null;
    const { id, username } = (await me.json()) as { id?: unknown; username?: unknown };
    if (typeof id !== "string" || !DISCORD_ID.test(id) || typeof username !== "string") return null;
    return { discordId: id, discordUsername: username.slice(0, 64) };
  };

  const callback = async (req: Request): Promise<Response> => {
    if (!config) return notFound();
    const query = new URL(req.url).searchParams;
    const signedUser = verifyDiscordState(
      secret,
      readCookie(req.headers, DISCORD_STATE_COOKIE),
      query.get("state"),
      now(),
    );
    const code = query.get("code");
    const userId = signedUser && code ? await activeUser(req) : null;
    if (!userId || !code || userId.toHexString() !== signedUser) return land(req, "error");
    try {
      const linked = await fetchDiscordUser(config, code);
      if (!linked) return land(req, "error");
      const collection = await users();
      const holder = await collection.findOne({
        discordId: linked.discordId,
        _id: { $ne: userId },
      });
      if (holder) return land(req, "taken");
      await collection.updateOne({ _id: userId }, { $set: linked });
      return land(req, "linked");
    } catch (error) {
      if (isDuplicateKeyError(error)) return land(req, "taken");
      console.error("discord link: callback failed", error);
      return land(req, "error");
    }
  };

  const unlink = async (req: Request): Promise<Response> => {
    if (!config) return notFound();
    const refused = crossSite(req, config);
    if (refused) return refused;
    const user = await currentUser(req);
    if (!user || !ObjectId.isValid(user.id)) return jsonError(401, "Sign in first.");
    await (await users()).updateOne(
      { _id: new ObjectId(user.id) },
      { $unset: { discordId: 1, discordUsername: 1 } },
    );
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  };

  return { start, callback, unlink };
};
