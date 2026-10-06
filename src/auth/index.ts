/**
 * @file src/auth/index.ts
 * @desc @haruhimemoe/next-kit/auth: better-auth with osu! sign-in. createOsuAuth, the osu!
 *       provider pieces, the indexes better-auth's collections need, and reading the caller.
 *       Server only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
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
export { AUTH_INDEX_SPECS, AUTH_INDEXES } from "./indexes.js";
export {
  OSU_PROVIDER_ID,
  OSU_USER_FIELDS,
  type OsuProviderOptions,
  osuProfileToUser,
  osuProvider,
  withoutTokens,
} from "./osu.js";
export {
  getOsuUser,
  type OsuSession,
  type OsuSessionUser,
  type SessionReader,
  toSessionUser,
} from "./session.js";
