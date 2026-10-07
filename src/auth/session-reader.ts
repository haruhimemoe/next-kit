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

import type { Db, Filter } from "mongodb";
import { SESSION_UPDATE_AGE_SECONDS } from "./create.js";
import { findSessionCookie, verifySignedToken } from "./session-cookie.js";

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

    if (now() - session.updatedAt.getTime() > updateAgeSeconds * 1000)
      pingHub(`${found.name}=${raw}`);

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
