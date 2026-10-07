/**
 * @file src/auth/session.ts
 * @desc Reading the caller from a request's session cookie. Route handlers pass
 *       request.headers; server pages pass await headers(). Apps add their own rules on top
 *       (an admin list, refusing system accounts). Moved from packs and pools
 *       (getUserFromHeaders in src/lib/auth.ts).
 *
 *       0.12: OsuSessionUser and OsuSession gain bannedAt (identity user fields, section 3).
 *       getSessionUser, requireSession and requireAdmin are new: they take either the hub's
 *       better-auth instance (the HubSessionSource shape, same as getOsuUser always took) or a
 *       createSessionReader instance (SatelliteSessionSource), so an app's call sites don't
 *       need to know which one they're on. requireSession and requireAdmin refuse a banned
 *       user (null, same as no session); getOsuUser and getSessionUser don't, by design, so
 *       `requireSession` is the one call every route that must be signed in and unbanned uses.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

/** The signed-in osu! user, as both apps pass it around. */
export type OsuSessionUser = {
  id: string;
  osuId: number;
  username: string;
  avatarUrl: string | null;
  /** When they were banned (requireSession and requireAdmin refuse them); null otherwise. Only
   * ever set on the identity user, read through the hub or a satellite's session reader. */
  bannedAt?: Date | string | null;
};

/** A session as better-auth returns it with the osu! user fields. */
export type OsuSession = {
  user: {
    id: string;
    osuId: number;
    username: string;
    avatarUrl?: string | null | undefined;
    bannedAt?: Date | string | null | undefined;
  };
};

/** What getOsuUser needs from a better-auth instance (the hub, or a single-DB 0.11 app). */
export type SessionReader = {
  api: { getSession: (input: { headers: Headers }) => Promise<OsuSession | null> };
};

/** A satellite's createSessionReader instance: the other shape getSessionUser, requireSession
 * and requireAdmin accept. Spelled out here (rather than imported) so this file doesn't need
 * session-reader.ts, which pulls in node:crypto. */
export type SatelliteSessionReader = {
  getSession: (headers: Headers) => Promise<{
    user: {
      id: string;
      osuId: number;
      username: string;
      avatarUrl: string | null;
      bannedAt?: Date | string | null;
    };
  } | null>;
};

/** Either session source: the hub's better-auth instance or a satellite's reader. */
export type SessionSource = SessionReader | SatelliteSessionReader;

const isSatelliteReader = (source: SessionSource): source is SatelliteSessionReader =>
  !("api" in source);

/**
 * @function toSessionUser
 * @param session {OsuSession} a session better-auth returned
 * @returns {OsuSessionUser} id, osu! id, username, avatar (null when there is none) and
 *          bannedAt when the identity user carries one
 */
export const toSessionUser = ({ user }: OsuSession): OsuSessionUser => ({
  id: user.id,
  osuId: user.osuId,
  username: user.username,
  avatarUrl: user.avatarUrl ?? null,
  ...(user.bannedAt !== undefined ? { bannedAt: user.bannedAt } : {}),
});

/**
 * @function getOsuUser
 * @param auth {SessionReader} the better-auth instance (createOsuAuth's)
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<OsuSessionUser | null>} the signed-in user, or null (no, forged or expired
 *          session). Never checks bannedAt: use requireSession where a ban must refuse.
 */
export const getOsuUser = async (
  auth: SessionReader,
  headers: Headers,
): Promise<OsuSessionUser | null> => {
  const session = await auth.api.getSession({ headers });
  return session ? toSessionUser(session) : null;
};

/**
 * @function getSessionUser
 * @param source {SessionSource} the hub's better-auth instance or a satellite's session reader
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<OsuSessionUser | null>} the signed-in user from either source, or null.
 *          Never checks bannedAt (same as getOsuUser): use requireSession for that.
 */
export const getSessionUser = async (
  source: SessionSource,
  headers: Headers,
): Promise<OsuSessionUser | null> => {
  if (isSatelliteReader(source)) {
    const read = await source.getSession(headers);
    return read ? { ...read.user, bannedAt: read.user.bannedAt ?? null } : null;
  }
  return getOsuUser(source, headers);
};

/**
 * @function requireSession
 * @param source {SessionSource} the hub's better-auth instance or a satellite's session reader
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<OsuSessionUser | null>} the signed-in user, or null for no session, a
 *          forged or expired one, or a banned user (bannedAt set)
 */
export const requireSession = async (
  source: SessionSource,
  headers: Headers,
): Promise<OsuSessionUser | null> => {
  const user = await getSessionUser(source, headers);
  return user && !user.bannedAt ? user : null;
};

/**
 * @function requireAdmin
 * @param source {SessionSource} the hub's better-auth instance or a satellite's session reader
 * @param headers {Headers} request headers (the session cookie)
 * @param adminOsuIds {ReadonlySet<number> | readonly number[]} the admin allowlist (apps read
 *        it with env's readIdSet("ADMIN_OSU_IDS"))
 * @returns {Promise<OsuSessionUser | null>} the signed-in user when they're unbanned and their
 *          osu! id is in adminOsuIds; null otherwise
 */
export const requireAdmin = async (
  source: SessionSource,
  headers: Headers,
  adminOsuIds: ReadonlySet<number> | readonly number[],
): Promise<OsuSessionUser | null> => {
  const user = await requireSession(source, headers);
  if (!user) return null;
  const admins = adminOsuIds instanceof Set ? adminOsuIds : new Set(adminOsuIds);
  return admins.has(user.osuId) ? user : null;
};
