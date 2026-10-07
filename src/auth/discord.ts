/**
 * @file src/auth/discord.ts
 * @desc The Discord link's pieces (0.13): its config from env (null turns the feature off), the
 *       signed state cookie and the authorize URL. An in-house OAuth2 code flow, not
 *       better-auth's genericOAuth: a second provider would create account rows and enter
 *       better-auth's linking code. The state cookie holds `state.userId.issuedAt.mac`, an
 *       HMAC-SHA256 (base64url) over the first three parts; every compare is constant time with
 *       the length checked first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The Discord app's credentials and the hub's callback URL. */
export type DiscordLinkConfig = { clientId: string; clientSecret: string; redirectUri: string };

/** The only scope asked for: the Discord id and name, nothing else. */
export const DISCORD_SCOPES = Object.freeze(["identify"] as const);
/** The state cookie's name (host-only on the hub, scoped to the Discord routes). */
export const DISCORD_STATE_COOKIE = "haruhime-discord-state";
/** The path the state cookie is scoped to. */
export const DISCORD_STATE_PATH = "/api/account/discord";
/** The callback path under the hub's origin. */
export const DISCORD_CALLBACK_PATH = `${DISCORD_STATE_PATH}/callback`;
/** How long a started link stays valid. */
export const DISCORD_STATE_TTL_SECONDS = 600;

const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";

/**
 * @function discordLinkConfig
 * @param env {Record<string, string | undefined>} process.env or a parsed copy
 * @param hubUrl {string} BETTER_AUTH_URL, the hub's origin
 * @returns {DiscordLinkConfig | null} null when DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is
 *          unset: the feature is off
 */
export const discordLinkConfig = (
  env: Record<string, string | undefined>,
  hubUrl: string,
): DiscordLinkConfig | null => {
  const clientId = env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: new URL(DISCORD_CALLBACK_PATH, hubUrl).href };
};

/**
 * @function newDiscordState
 * @returns {string} 32 random bytes, base64url
 */
export const newDiscordState = (): string => randomBytes(32).toString("base64url");

const mac = (secret: string, payload: string): Buffer =>
  createHmac("sha256", secret).update(`discord-link:${payload}`).digest();

const sameBytes = (a: Buffer, b: Buffer): boolean => a.length === b.length && timingSafeEqual(a, b);

/**
 * @function signDiscordState
 * @param secret {string} BETTER_AUTH_SECRET
 * @param state {string} the random state sent to Discord
 * @param userId {string} the signed-in user starting the link
 * @param issuedAt {number} the clock, ms
 * @returns {string} the state cookie's value
 */
export const signDiscordState = (
  secret: string,
  state: string,
  userId: string,
  issuedAt: number,
): string => {
  const payload = `${state}.${userId}.${issuedAt}`;
  return `${payload}.${mac(secret, payload).toString("base64url")}`;
};

/**
 * @function verifyDiscordState
 * @param secret {string} BETTER_AUTH_SECRET
 * @param cookie {string | null} the state cookie's value
 * @param queryState {string | null} the `state` Discord sent back
 * @param now {number} the clock, ms
 * @returns {string | null} the user id that started the link, or null for a missing, forged,
 *          mismatched or expired state
 */
export const verifyDiscordState = (
  secret: string,
  cookie: string | null,
  queryState: string | null,
  now: number,
): string | null => {
  if (!cookie || !queryState) return null;
  const parts = cookie.split(".");
  if (parts.length !== 4) return null;
  const [state, userId, issued, signature] = parts as [string, string, string, string];
  const payload = `${state}.${userId}.${issued}`;
  if (!sameBytes(Buffer.from(signature, "base64url"), mac(secret, payload))) return null;
  if (!sameBytes(Buffer.from(queryState), Buffer.from(state))) return null;
  const issuedAt = Number(issued);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now) return null;
  if (now - issuedAt > DISCORD_STATE_TTL_SECONDS * 1000) return null;
  return userId;
};

/**
 * @function discordAuthorizeUrl
 * @param config {DiscordLinkConfig} the Discord app
 * @param state {string} the random state
 * @returns {string} Discord's authorize URL (code flow, identify, prompt=none)
 */
export const discordAuthorizeUrl = (config: DiscordLinkConfig, state: string): string => {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: DISCORD_SCOPES.join(" "),
    redirect_uri: config.redirectUri,
    state,
    prompt: "none",
  }).toString();
  return url.href;
};

/**
 * @function readCookie
 * @param headers {Headers} request headers
 * @param name {string} a cookie name
 * @returns {string | null} its raw value (the first one), or null
 */
export const readCookie = (headers: Headers, name: string): string | null => {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index !== -1 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
};
