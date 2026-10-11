/**
 * @file src/preferences/index.ts
 * @desc @haruhimemoe/next-kit/preferences: a user's display preferences (time zone, 12h/24h),
 *       pure and client-safe. parsePreferences/serializePreferences for the stored string,
 *       formatInstant for turning an ISO instant into display text with those preferences
 *       applied. No Mongo, no Next, no "use client": safe in a browser bundle or a server
 *       render alike. The reader/writer/route live in ./server (./preferences/server), kept out
 *       of this entry point on purpose.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

export { type FormatPrefs, formatInstant } from "./format.js";
export {
  DEFAULT_PREFERENCES,
  type Preferences,
  PreferencesSchema,
  parsePreferences,
  serializePreferences,
} from "./schema.js";
