/**
 * @file src/server/safe-next.ts
 * @desc Where to go after sign-in. Only same-site absolute paths pass; anything else (other
 *       hosts, protocol-relative, backslashes, control characters, the sign-in page itself)
 *       becomes the caller's fallback, a page every signed-in user can open. Browser-safe, so
 *       @haruhimemoe/next-kit/auth-react exports it too. Moved from pools (src/utils/safe-next.ts);
 *       packs' copy let /signin through.
 *
 *       0.12: safeAbsoluteNext is the hub's sibling check for a satellite's full URL `next`
 *       (https://pools.haruhime.moe/p/abc, not a path). It parses with `new URL()` (a malformed
 *       URL is unsafe, not a fallback-by-accident), requires `https:`, requires no userinfo
 *       (`user@host` URLs are refused even when the host matches: a browser displays the host
 *       after `@`, but server-side redirect logic must not), and matches `url.hostname` exactly,
 *       case-insensitively, against an allowlist of full hostnames. Never a suffix or prefix
 *       match: `haruhime.moe.evil.com` and `evilharuhime.moe` both fail an allowlist of
 *       `["haruhime.moe"]`, and an unlisted subdomain (`new.haruhime.moe`) fails unless it's in
 *       the list too. Satellites may build this check themselves as a convenience, but the hub
 *       re-validates `next` on arrival and is the authoritative check either way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
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

/** safeAbsoluteNext's options. */
export type SafeAbsoluteNextOptions = {
  /** Full hostnames `next` may point at, like ["haruhime.moe", "pools.haruhime.moe"]. Matched
   * exactly (case-insensitively); never as a suffix. */
  hosts: readonly string[];
  /** Where to go when `next` isn't safe. */
  fallback: string;
};

/**
 * @function safeAbsoluteNext
 * @param raw {string | null | undefined} an untrusted absolute ?next= value
 * @param options {SafeAbsoluteNextOptions} the hostname allowlist and the fallback
 * @returns {string} `raw` unchanged when it parses, is `https:`, carries no userinfo and its
 *          hostname exactly matches one entry of `hosts`; the fallback otherwise
 */
export const safeAbsoluteNext = (
  raw: string | null | undefined,
  { hosts, fallback }: SafeAbsoluteNextOptions,
): string => {
  if (!raw || raw.length > MAX_NEXT_LENGTH) return fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fallback;
  }
  if (url.protocol !== "https:") return fallback;
  if (url.username || url.password) return fallback;
  const hostname = url.hostname.toLowerCase();
  if (!hosts.some((host) => host.toLowerCase() === hostname)) return fallback;
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
