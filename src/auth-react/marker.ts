/**
 * @file src/auth-react/marker.ts
 * @desc A readable "this browser may be signed in" cookie. It holds no secret; it only tells the
 *       page whether asking the server for the session is worth a request, so visitors who never
 *       sign in cost none. The server sets it with the session and clears it on sign-out or a
 *       missing session (createOsuAuth in @haruhimemoe/next-kit/auth). Browser-safe. Moved from
 *       packs and pools (src/lib/signed-in-marker.ts), which differed only in the cookie name.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** The marker for one cookie name. */
export type SignedInMarker = {
  /** The cookie's name, like "pools-signed-in". */
  name: string;
  /** True when a Cookie header (or document.cookie) has the marker set. */
  has: (cookieHeader: string) => boolean;
  /** Expires the marker on a document (tests pass a stand-in). */
  clear: (target?: { cookie: string }) => void;
};

/**
 * @function markerMaxAge
 * @param expiresAt {Date | string} when the session expires
 * @param now {number} current time in ms (tests)
 * @returns {number} whole seconds until then, at least 0
 */
export const markerMaxAge = (expiresAt: Date | string, now: number = Date.now()): number =>
  Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));

/**
 * @function createSignedInMarker
 * @param name {string} the cookie's name, one per app
 * @returns {SignedInMarker} has and clear for that cookie
 */
export const createSignedInMarker = (name: string): SignedInMarker => ({
  name,
  has: (cookieHeader) => cookieHeader.split(/;\s*/).includes(`${name}=1`),
  clear: (target = document) => {
    target.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  },
});
