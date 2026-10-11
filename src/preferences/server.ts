/**
 * @file src/preferences/server.ts
 * @desc @haruhimemoe/next-kit/preferences/server: reading and writing a user's preferences on
 *       the identity database, and the hub's route. readPreferences/writePreferences touch only
 *       the `preferences` field on identity.user (never another field), the same shape
 *       discord-routes.ts writes discordId/discordUsername with. createPreferencesRoute's POST
 *       sits behind refuseCrossSite like every other hub write, checked first (same order as
 *       discord-routes.ts): 403 cross-site, 401 signed out or a malformed session user id, 400
 *       on a schema failure (an unknown zone, say). A separate subpath from ./preferences on
 *       purpose: this one loads mongodb, so the pure, client-safe entry point never does.
 *
 *       review fix round 1: writePreferences now guards userId with ObjectId.isValid, same as
 *       readPreferences, instead of letting a malformed id throw out of the MongoDB driver;
 *       POST checks that guard (as 401, not a thrown error) and moved its refuseCrossSite check
 *       ahead of the session check to match discord-routes.ts's order.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { type Db, ObjectId } from "mongodb";
import { refuseCrossSite } from "../server/cross-site.js";
import { jsonError, noStore } from "../server/errors.js";
import {
  type Preferences,
  PreferencesSchema,
  parsePreferences,
  serializePreferences,
} from "./schema.js";

/** createPreferencesRoute's options. */
export type PreferencesRouteOptions = {
  /** The identity database (the `user` collection lives here). */
  db: Db;
  /** The caller's session, however the app reads it; null for signed out. */
  getSession: (req: Request) => Promise<{ user: { id: string } } | null>;
};

/**
 * @function readPreferences
 * @param db {Db} the identity database
 * @param userId {string} the identity user's id
 * @returns {Promise<Preferences>} their stored preferences, or DEFAULT_PREFERENCES when there
 *          is no user, no stored value, or the stored value doesn't parse
 */
export const readPreferences = async (db: Db, userId: string): Promise<Preferences> => {
  if (!ObjectId.isValid(userId)) return parsePreferences(undefined);
  const row = await db
    .collection("user")
    .findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } });
  return parsePreferences(row?.preferences);
};

/**
 * @function writePreferences
 * @param db {Db} the identity database
 * @param userId {string} the identity user's id
 * @param p {Preferences} valid preferences to store
 * @returns {Promise<void>} writes only `preferences` on that user row
 * @throws {TypeError} when userId isn't a valid ObjectId (same guard as readPreferences, but a
 *         write has nothing sensible to fall back to, so it throws instead of silently no-op)
 * @throws {z.ZodError} when p doesn't match PreferencesSchema
 */
export const writePreferences = async (db: Db, userId: string, p: Preferences): Promise<void> => {
  if (!ObjectId.isValid(userId)) {
    throw new TypeError("writePreferences: userId must be a valid ObjectId");
  }
  await db
    .collection("user")
    .updateOne({ _id: new ObjectId(userId) }, { $set: { preferences: serializePreferences(p) } });
};

/**
 * @function createPreferencesRoute
 * @param options {PreferencesRouteOptions} the identity database and a session reader
 * @returns {{ GET; POST }} GET answers the caller's preferences (401 signed out); POST checks
 *          cross-site first (403), then a signed-out caller or a malformed session user id
 *          (401), then 400s a schema failure, otherwise writes and answers the stored
 *          preferences. Every answer is no-store.
 */
export const createPreferencesRoute = ({ db, getSession }: PreferencesRouteOptions) => {
  const GET = async (req: Request): Promise<Response> => {
    const session = await getSession(req);
    if (!session) return noStore(jsonError(401, "Sign in first."));
    return noStore(Response.json(await readPreferences(db, session.user.id)));
  };

  const POST = async (req: Request): Promise<Response> => {
    const refused = refuseCrossSite(req, {
      siteUrl: new URL(req.url).origin,
      siteTitle: "this app",
    });
    if (refused) return noStore(refused);
    const session = await getSession(req);
    if (!session || !ObjectId.isValid(session.user.id)) {
      return noStore(jsonError(401, "Sign in first."));
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return noStore(jsonError(400, "That request wasn't valid JSON."));
    }
    const parsed = PreferencesSchema.partial().safeParse(body);
    if (!parsed.success) {
      return noStore(jsonError(400, parsed.error.issues[0]?.message ?? "Invalid preferences."));
    }
    const preferences: Preferences = {
      timezone: parsed.data.timezone ?? null,
      hourCycle: parsed.data.hourCycle ?? null,
    };
    await writePreferences(db, session.user.id, preferences);
    return noStore(Response.json(preferences));
  };

  return { GET, POST };
};
