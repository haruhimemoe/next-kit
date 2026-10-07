/**
 * @file src/inbox/auth.ts
 * @desc Which registered app sent a request: the bearer is compared (sameSecret, SHA-256 then
 *       timingSafeEqual) against every configured app secret with no early exit, so the time
 *       taken doesn't say which app matched. Exactly one match names the app. Unset secrets and
 *       secrets under 32 bytes are skipped.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { type AccountApp, secretFor } from "../account/registry.js";
import { sameSecret } from "../server/machine-auth.js";

/** What matchApp found: the app, nobody, or no app has a secret at all. */
export type AppMatch = { app: AccountApp } | { app: null; configured: boolean };

/**
 * @function matchApp
 * @param token {string | null} the request's bearer token
 * @param apps {readonly AccountApp[]} the registry
 * @param env {Record<string, string | undefined>} where the secrets live
 * @returns {AppMatch} the one app whose secret equals the token, else null (configured says
 *          whether any app had a usable secret)
 */
export const matchApp = (
  token: string | null,
  apps: readonly AccountApp[],
  env: Record<string, string | undefined>,
): AppMatch => {
  let configured = false;
  const matched: AccountApp[] = [];
  for (const app of apps) {
    const secret = secretFor(app, env);
    if (secret === undefined) continue;
    configured = true;
    // Always compare, even with no token, so each call does the same work per app.
    if (sameSecret(token ?? "", secret) && token !== null) matched.push(app);
  }
  const [only] = matched;
  return matched.length === 1 && only ? { app: only } : { app: null, configured };
};
