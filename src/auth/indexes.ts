/**
 * @file src/auth/indexes.ts
 * @desc The indexes better-auth's MongoDB collections need and don't get on their own: one user
 *       per osu! id (two sign-ins racing can't make two), one account row per osu! link, one
 *       session per token (every signed-in request looks it up; a secret, so never logged), and
 *       sessions by user, plus the TTL index that deletes a session about a minute after it
 *       expires. Pass AUTH_INDEX_SPECS to ensureIndexes. Moved from pools (src/lib/db-indexes.ts,
 *       src/constants/db.ts); packs had only the session TTL, so its session lookups scanned.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { IndexSpec } from "../mongo/indexes.js";

/** Index names on better-auth's collections. */
export const AUTH_INDEXES = Object.freeze({
  userOsuId: "user_osuId_unique",
  accountKey: "account_providerId_accountId_unique",
  sessionToken: "session_token_unique",
  sessionUser: "session_userId",
  sessionTtl: "session_expiresAt_ttl",
});

/** The five indexes, for ensureIndexes from @haruhimemoe/next-kit/mongo. */
export const AUTH_INDEX_SPECS: readonly IndexSpec[] = Object.freeze([
  { collection: "user", key: { osuId: 1 }, name: AUTH_INDEXES.userOsuId, unique: true },
  {
    collection: "account",
    key: { providerId: 1, accountId: 1 },
    name: AUTH_INDEXES.accountKey,
    unique: true,
  },
  {
    collection: "session",
    key: { token: 1 },
    name: AUTH_INDEXES.sessionToken,
    unique: true,
    secret: true,
  },
  { collection: "session", key: { userId: 1 }, name: AUTH_INDEXES.sessionUser },
  {
    collection: "session",
    key: { expiresAt: 1 },
    name: AUTH_INDEXES.sessionTtl,
    expireAfterSeconds: 0,
  },
]);
