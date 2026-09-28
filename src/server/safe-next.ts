/**
 * @file src/server/safe-next.ts
 * @desc Where to go after sign-in. Only same-site absolute paths pass; anything else (other
 *       hosts, protocol-relative, backslashes, control characters, the sign-in page itself)
 *       becomes the caller's fallback, a page every signed-in user can open. Browser-safe, so
 *       @haruhimemoe/next-kit/auth-react exports it too. Moved from pools (src/utils/safe-next.ts);
 *       packs' copy let /signin through.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** The sign-in page both sites use. */
export const DEFAULT_SIGN_IN_PATH = "/signin";

/** A `next` longer than this is refused unread. */
export const MAX_NEXT_LENGTH = 512;

/** safeNextPath's options. */
export type SafeNextOptions = {
  /** Where to go when `next` isn't safe (pools: /account, packs: /me). */
  fallback: string;
  /** The sign-in page, never a `next` (default DEFAULT_SIGN_IN_PATH). */
  signInPath?: string;
};

const hasControlCharacter = (value: string): boolean =>
  [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * @function safeNextPath
 * @param raw {string | null | undefined} untrusted ?next= value
 * @param options {SafeNextOptions} the fallback and the sign-in page
 * @returns {string} a same-site path, or the fallback
 */
export const safeNextPath = (
  raw: string | null | undefined,
  { fallback, signInPath = DEFAULT_SIGN_IN_PATH }: SafeNextOptions,
): string => {
  if (!raw || raw.length > MAX_NEXT_LENGTH) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\") || hasControlCharacter(raw)) return fallback;
  // The sign-in page with a session goes on to `next`: back to itself would never end.
  if (new RegExp(`^${escapeRegExp(signInPath)}(?:[/?#]|$)`).test(raw)) return fallback;
  return raw;
};

/**
 * @function signInHref
 * @param next {string} where to land after signing in
 * @param signInPath {string} the sign-in page (default DEFAULT_SIGN_IN_PATH)
 * @returns {string} the sign-in link carrying it, like /signin?next=%2Fpacks
 */
export const signInHref = (next: string, signInPath: string = DEFAULT_SIGN_IN_PATH): string =>
  `${signInPath}?next=${encodeURIComponent(next)}`;
