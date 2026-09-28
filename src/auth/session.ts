/**
 * @file src/auth/session.ts
 * @desc Reading the caller from a request's session cookie. Route handlers pass
 *       request.headers; server pages pass await headers(). Apps add their own rules on top
 *       (an admin list, refusing system accounts). Moved from packs and pools
 *       (getUserFromHeaders in src/lib/auth.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** The signed-in osu! user, as both apps pass it around. */
export type OsuSessionUser = {
  id: string;
  osuId: number;
  username: string;
  avatarUrl: string | null;
};

/** A session as better-auth returns it with the osu! user fields. */
export type OsuSession = {
  user: { id: string; osuId: number; username: string; avatarUrl?: string | null | undefined };
};

/** What getOsuUser needs from a better-auth instance. */
export type SessionReader = {
  api: { getSession: (input: { headers: Headers }) => Promise<OsuSession | null> };
};

/**
 * @function toSessionUser
 * @param session {OsuSession} a session better-auth returned
 * @returns {OsuSessionUser} id, osu! id, username and avatar (null when there is none)
 */
export const toSessionUser = ({ user }: OsuSession): OsuSessionUser => ({
  id: user.id,
  osuId: user.osuId,
  username: user.username,
  avatarUrl: user.avatarUrl ?? null,
});

/**
 * @function getOsuUser
 * @param auth {SessionReader} the better-auth instance (createOsuAuth's)
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<OsuSessionUser | null>} the signed-in user, or null (no, forged or expired
 *          session)
 */
export const getOsuUser = async (
  auth: SessionReader,
  headers: Headers,
): Promise<OsuSessionUser | null> => {
  const session = await auth.api.getSession({ headers });
  return session ? toSessionUser(session) : null;
};
