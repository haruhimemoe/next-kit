/**
 * @file src/auth/discord-lookup.ts
 * @desc findUserByDiscordId (0.13): for harumin and satellites, a read-only lookup of the
 *       identity user who linked a Discord account. A banned user reads as no user.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { Db } from "mongodb";
import type { OsuSessionUser } from "./session.js";

type LinkedUserDoc = {
  _id: unknown;
  osuId: number;
  username: string;
  avatarUrl?: string | null;
  image?: string | null;
  bannedAt?: Date | null;
};

/**
 * @function findUserByDiscordId
 * @param identityDb {Db} the identity database (a read-only user is enough)
 * @param discordId {string} a Discord user id (snowflake)
 * @returns {Promise<OsuSessionUser | null>} the linked user, or null when nobody linked it,
 *          the id is malformed, or the user is banned
 */
export const findUserByDiscordId = async (
  identityDb: Db,
  discordId: string,
): Promise<OsuSessionUser | null> => {
  if (typeof discordId !== "string" || !/^\d{1,20}$/.test(discordId)) return null;
  const user = await identityDb.collection<LinkedUserDoc>("user").findOne({ discordId });
  if (!user || user.bannedAt) return null;
  return {
    id: String(user._id),
    osuId: user.osuId,
    username: user.username,
    avatarUrl: user.avatarUrl ?? user.image ?? null,
  };
};
