/**
 * @file src/auth-react/sign-in.ts
 * @desc What a "Sign in with osu!" button sends better-auth: the provider, where to land, and an
 *       error page that keeps `next`, so a failed sign-in explains itself and can still go on
 *       (better-auth adds &error=<code>). pools did this; packs sent /signin?error=oauth and
 *       lost `next`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { OSU_PROVIDER_ID } from "../auth/osu-id.js";
import { DEFAULT_SIGN_IN_PATH, signInHref } from "../server/safe-next.js";

/** The body of authClient.signIn.social for osu!. */
export type OsuSignIn = { provider: string; callbackURL: string; errorCallbackURL: string };

/**
 * @function osuSignIn
 * @param next {string} where to land after signing in (already checked with safeNextPath)
 * @param signInPath {string} the sign-in page (default /signin)
 * @returns {OsuSignIn} { provider: "osu", callbackURL: next, errorCallbackURL:
 *          "/signin?next=<next>" }
 */
export const osuSignIn = (next: string, signInPath: string = DEFAULT_SIGN_IN_PATH): OsuSignIn => ({
  provider: OSU_PROVIDER_ID,
  callbackURL: next,
  errorCallbackURL: signInHref(next, signInPath),
});
