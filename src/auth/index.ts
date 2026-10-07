/**
 * @file src/auth/index.ts
 * @desc @haruhimemoe/next-kit/auth: better-auth with osu! sign-in. createOsuAuth, the osu!
 *       provider pieces, the indexes better-auth's collections need, reading the caller, and
 *       (0.13) the hub's Discord link plus findUserByDiscordId.
 *       Server only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

export {
  type AuthRow,
  createOsuAuth,
  type OsuAuth,
  type OsuAuthHooks,
  type OsuAuthOptions,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  type UserFields,
} from "./create.js";
export {
  DISCORD_SCOPES,
  DISCORD_STATE_COOKIE,
  type DiscordLinkConfig,
  discordLinkConfig,
} from "./discord.js";
export { findUserByDiscordId } from "./discord-lookup.js";
export {
  createDiscordLinkRoutes,
  type DiscordLinkOutcome,
  type DiscordLinkRoutesOptions,
} from "./discord-routes.js";
export { AUTH_INDEX_SPECS, AUTH_INDEXES } from "./indexes.js";
export {
  IDENTITY_USER_FIELDS,
  OSU_PROVIDER_ID,
  OSU_USER_FIELDS,
  type OsuProviderOptions,
  osuProfileToUser,
  osuProvider,
  withoutTokens,
} from "./osu.js";
export {
  getOsuUser,
  getSessionUser,
  type OsuAuthInstance,
  type OsuSession,
  type OsuSessionUser,
  requireAdmin,
  requireSession,
  type SatelliteSessionReader,
  type SessionSource,
  toSessionUser,
} from "./session.js";
export {
  createSessionReader,
  DEFAULT_SESSION_COOKIE_NAME,
  type ReadSession,
  type SessionReader,
  /** @deprecated use SessionReader */
  type SessionReaderInstance,
  type SessionReaderOptions,
} from "./session-reader.js";
