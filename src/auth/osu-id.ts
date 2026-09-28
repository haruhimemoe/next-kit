/**
 * @file src/auth/osu-id.ts
 * @desc The osu! provider id on its own, so browser code (osuSignIn) can use it without loading
 *       the profile mapping.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** better-auth genericOAuth provider id; also the last segment of the callback path. */
export const OSU_PROVIDER_ID = "osu";
