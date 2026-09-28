/**
 * @file src/auth/osu.ts
 * @desc The osu! pieces of better-auth: the provider id, the extra user fields, the profile
 *       mapping (through @haruhimemoe/osu's toOsuUser, with a synthetic email since osu! gives
 *       none), the genericOAuth provider config (identify + public, PKCE, profile refreshed on
 *       every sign-in), and dropping OAuth tokens from account writes. Moved from packs and
 *       pools (src/lib/auth.ts, src/constants/auth.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
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
