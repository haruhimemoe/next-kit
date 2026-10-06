/**
 * @file src/auth/session-reader.ts
 * @desc createSessionReader: a satellite's read of the hub's identity session, with no
 *       `betterAuth()` instance and no database writes. better-auth's own `/get-session` writes
 *       on refresh once `updateAge` passes, which a read-only satellite can't do (and shouldn't:
 *       the hub owns every write to `identity`). So this verifies the signed
 *       `better-auth.session_token` cookie itself (HMAC-SHA256 over the token, base64, the same
 *       `${token}.${signature}` shape `better-auth/crypto`'s makeSignature produces) with
 *       node:crypto and a constant-time compare, then reads `identity.session` and
 *       `identity.user` directly. Past `updateAge`, it fires a request at the hub's own
 *       `/api/auth/get-session` (forwarding the cookie) to extend it there, fire-and-forget: a
 *       failed ping just means the session ages out from its last real refresh instead of
 *       being renewed. `fetchImpl` is injectable for tests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db, Filter } from "mongodb";
import { SESSION_UPDATE_AGE_SECONDS } from "./create.js";

/** better-auth's own cookie name, before any __Secure- prefix. */
export const DEFAULT_SESSION_COOKIE_NAME = "better-auth.session_token";

/** A raw identity.session row, as better-auth's MongoDB adapter writes it. */
type SessionDoc = {
  token: string;
  userId: unknown;
  expiresAt: Date;
  updatedAt: Date;
};

/** A raw identity.user row, as far as the reader needs it. */
type UserDoc = {
  _id: unknown;
  osuId: number;
  username: string;
  avatarUrl?: string | null;
  image?: string | null;
  bannedAt?: Date | null;
  banReason?: string | null;
};

/** What createSessionReader reads: the signed-in user (with ban fields) and the session. */
export type ReadSession = {
  user: {
    id: string;
    osuId: number;
    username: string;
    avatarUrl: string | null;
    bannedAt: Date | null;
    banReason: string | null;
  };
  session: { expiresAt: Date; updatedAt: Date };
};

/** createSessionReader's options. */
export type SessionReaderOptions = {
  /** The hub's identity database, read-only from a satellite's own Atlas user. */
  identityDb: Db;
  /** BETTER_AUTH_SECRET, shared with the hub. */
  secret: string;
  /** The hub's own origin, like "https://haruhime.moe"; the refresh ping's target. */
  hubUrl: string;
  /** better-auth's cookie name before any secure prefix (default DEFAULT_SESSION_COOKIE_NAME);
   * a `__Secure-`/`__Host-` prefixed cookie under the same base name is read too. */
  cookieName?: string;
  /** How old a session can get before a read pings the hub to refresh it (default
   * SESSION_UPDATE_AGE_SECONDS). */
  updateAgeSeconds?: number;
  /** fetch, injectable so tests can assert the ping without a network call. */
  fetchImpl?: typeof fetch;
  /** The clock (tests). */
  now?: () => number;
};

/** What createSessionReader returns. getSession reads with zero database writes: null for no
 * cookie, a bad signature, an expired session, or a session whose user no longer exists. A
 * banned user is still returned (bannedAt set): refusing them is requireSession's job. */
export type SessionReader = { getSession: (headers: Headers) => Promise<ReadSession | null> };

/** A canonical base64 HMAC-SHA256: 43 chars and one "=" pad, as better-call's makeSignature
 * writes it and its getSignedCookie requires. */
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The hub's origin, refusing anything but https (plain http only for localhost): the refresh
 * ping forwards the session cookie there. */
const hubOrigin = (hubUrl: string): string => {
  const url = new URL(hubUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error(`createSessionReader: hubUrl must be https (got ${url.protocol}//${url.host})`);
  }
  return url.origin;
};

const parseCookieHeader = (header: string): Map<string, string> => {
  const cookies = new Map<string, string>();
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    // First one wins, same as better-call's parseCookies.
    if (!name || cookies.has(name)) continue;
    cookies.set(name, part.slice(index + 1).trim());
  }
  return cookies;
};

/**
 * @function findSessionCookie
 * @param headers {Headers} request headers
 * @param cookieName {string} better-auth's base cookie name
 * @returns {{ name: string; value: string } | null} the cookie's name and raw value, trying
 *          the bare name and the __Secure-/__Host- prefixed ones (whichever better-auth's own secureCookiePrefix picked), secure first
 */
const findSessionCookie = (
  headers: Headers,
  cookieName: string,
): { name: string; value: string } | null => {
  const header = headers.get("cookie");
  if (!header) return null;
  const cookies = parseCookieHeader(header);
  // The __Secure- name first: it's the one better-auth sets on https, and a stale or planted
  // bare-name cookie must not shadow it.
  for (const name of [`__Secure-${cookieName}`, `__Host-${cookieName}`, cookieName]) {
    const value = cookies.get(name);
    if (value !== undefined) return { name, value };
  }
  return null;
};

/**
 * @function verifySignedToken
 * @param value {string} the cookie's decoded value, `${token}.${signature}`
 * @param secret {string} BETTER_AUTH_SECRET
 * @returns {string | null} the token when its signature (HMAC-SHA256, base64, over the token
 *          alone) matches, compared in constant time; null otherwise. A session token never
 *          contains ".", so the last "." splits token from signature.
 */
const verifySignedToken = (value: string, secret: string): string | null => {
  const separator = value.lastIndexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;
  const token = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  // better-call's getSignedCookie only accepts a canonical 44-char padded base64 signature.
  // Buffer.from(…, "base64") is lenient (skips bad chars, takes base64url), so check the shape
  // first or non-canonical signatures would verify here and fail on the hub.
  if (!SIGNATURE_PATTERN.test(signature)) return null;
  const expected = createHmac("sha256", secret).update(token).digest();
  const given = Buffer.from(signature, "base64");
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? token : null;
};

/**
 * @function createSessionReader
 * @param options {SessionReaderOptions} the identity database, the shared secret, the hub's
 *        URL, the cookie name, the refresh age and injectable fetch/clock
 * @returns {SessionReader} getSession, a raw read with no writes
 */
export const createSessionReader = ({
  identityDb,
  secret,
  hubUrl,
  cookieName = DEFAULT_SESSION_COOKIE_NAME,
  updateAgeSeconds = SESSION_UPDATE_AGE_SECONDS,
  fetchImpl = fetch,
  now = () => Date.now(),
}: SessionReaderOptions): SessionReader => {
  const pingUrl = new URL("/api/auth/get-session", hubOrigin(hubUrl));
  // Only the session cookie is forwarded, never the satellite's other cookies.
  const pingHub = (cookieHeader: string): void => {
    // redirect: "manual": the cookie only ever goes to the hub's own origin, never to wherever a
    // redirect points.
    fetchImpl(pingUrl, { headers: { cookie: cookieHeader }, redirect: "manual" }).catch(() => {
      // Fire-and-forget: a failed ping just means this session ages out from its last real
      // refresh instead of being extended. The caller's read already has its answer.
    });
  };

  const getSession = async (headers: Headers): Promise<ReadSession | null> => {
    const found = findSessionCookie(headers, cookieName);
    if (!found) return null;
    const raw = found.value;
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return null;
    }
    const token = verifySignedToken(decoded, secret);
    if (!token) return null;

    const session = await identityDb.collection<SessionDoc>("session").findOne({ token });
    if (!session || session.expiresAt.getTime() <= now()) return null;

    const user = await identityDb
      .collection<UserDoc>("user")
      .findOne({ _id: session.userId } as Filter<UserDoc>);
    if (!user) return null;

    if (now() - session.updatedAt.getTime() > updateAgeSeconds * 1000) pingHub(`${found.name}=${raw}`);

    return {
      user: {
        id: String(user._id),
        osuId: user.osuId,
        username: user.username,
        avatarUrl: user.avatarUrl ?? user.image ?? null,
        bannedAt: user.bannedAt ?? null,
        banReason: user.banReason ?? null,
      },
      session: { expiresAt: session.expiresAt, updatedAt: session.updatedAt },
    };
  };

  return { getSession };
};
