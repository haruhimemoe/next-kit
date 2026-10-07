/**
 * @file src/auth/osu.ts
 * @desc The osu! pieces of better-auth: the provider id, the extra user fields, the profile
 *       mapping (through @haruhimemoe/osu's toOsuUser, with a synthetic email since osu! gives
 *       none), the genericOAuth provider config (identify + public, PKCE, profile refreshed on
 *       every sign-in), and dropping OAuth tokens from account writes. Moved from packs and
 *       pools (src/lib/auth.ts, src/constants/auth.ts).
 *
 *       0.12: IDENTITY_USER_FIELDS adds the identity database's own fields (locale,
 *       notificationPrefs, bannedAt, banReason, limits, discordId, discordUsername; section 3).
 *       They're `input: false`: nothing a client sends ever sets them (requireSession reads
 *       bannedAt, a future admin route or the Discord link flow in 0.13 writes the rest
 *       straight through the adapter, bypassing better-auth's own field input). createOsuAuth
 *       merges these into every instance's additionalFields unconditionally; a single-DB 0.11
 *       app that never writes them just carries five always-empty columns, which costs
 *       nothing, and keeps the hub and every satellite reading the same user shape. App-only
 *       fields (packs' `system`) stay out of this list: they move to an app-side profile
 *       collection keyed by userId, since the identity user is shared across apps (CHANGELOG
 *       has packs' migration note).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

import { OSU_OAUTH, OSU_SIGN_IN_SCOPES, toOsuUser } from "@haruhimemoe/osu/shapes";
import { OSU_PROVIDER_ID } from "./osu-id.js";

export { OSU_PROVIDER_ID };

/** The fields osu! fills in on every user row. */
export const OSU_USER_FIELDS = {
  osuId: { type: "number", required: true },
  username: { type: "string", required: true },
  avatarUrl: { type: "string", required: false },
  countryCode: { type: "string", required: false },
} as const;

/** The identity database's own fields (section 3 of the identity spec): never set by a
 * client, only by the server (an admin route, the Discord link flow, requireSession's read of
 * bannedAt). `limits` is a free-form per-app override bag, stored as JSON text since
 * better-auth's additionalFields has no object type. */
export const IDENTITY_USER_FIELDS = {
  locale: { type: "string", required: false, input: false },
  notificationPrefs: { type: "string", required: false, input: false },
  bannedAt: { type: "date", required: false, input: false },
  banReason: { type: "string", required: false, input: false },
  limits: { type: "string", required: false, input: false },
  discordId: { type: "string", required: false, input: false },
  discordUsername: { type: "string", required: false, input: false },
} as const;

/**
 * @function osuProfileToUser
 * @param raw {unknown} the /api/v2/me profile better-auth fetched
 * @returns the better-auth user fields. osu! OAuth returns no email, so each osu! id gets a stable
 *          synthetic one (the adapter requires an email). better-auth wants image left out, not
 *          null, when there is no avatar.
 * @throws {z.ZodError} when the profile has no id or username (never guess an identity)
 */
export const osuProfileToUser = (raw: unknown) => {
  const user = toOsuUser(raw);
  return {
    email: `${user.osuId}@osu.local`,
    emailVerified: false as const,
    name: user.username,
    ...user,
    ...(user.avatarUrl ? { image: user.avatarUrl } : {}),
  };
};

/**
 * @function withoutTokens
 * @param account {T} an account write
 * @returns {T} the same fields with accessToken, refreshToken and idToken null: neither app calls
 *          osu! as the user, so none keeps osu! tokens
 */
export const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
  ...account,
  accessToken: null,
  refreshToken: null,
  idToken: null,
});

/** osuProvider's input: the osu! OAuth app's credentials. */
export type OsuProviderOptions = { clientId: string; clientSecret: string };

/**
 * @function osuProvider
 * @param options {OsuProviderOptions} the osu! app's client id and secret
 * @returns the genericOAuth config entry for osu!: identify + public scopes, PKCE, the profile
 *          mapped with osuProfileToUser and refreshed on every sign-in
 */
export const osuProvider = ({ clientId, clientSecret }: OsuProviderOptions) => ({
  providerId: OSU_PROVIDER_ID,
  clientId,
  clientSecret,
  ...OSU_OAUTH,
  scopes: [...OSU_SIGN_IN_SCOPES],
  pkce: true,
  overrideUserInfo: true,
  mapProfileToUser: osuProfileToUser,
});
