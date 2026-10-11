/**
 * @file src/preferences/schema.ts
 * @desc The stored shape of a user's display preferences: a time zone (an IANA name Intl
 *       accepts, or null for "use the browser's") and an hour cycle (h12, h23, or null for "the
 *       locale decides"). parsePreferences never throws: a stored string that isn't JSON, names
 *       an unknown zone, or is missing entirely falls back to DEFAULT_PREFERENCES, so a page
 *       render never breaks on a bad value. No @haruhimemoe/time import: next-kit takes no new
 *       dependency, so the zone check is inline.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { z } from "zod";

/**
 * @function isZone
 * @param zone {string} a candidate IANA time zone name
 * @returns {boolean} whether Intl accepts it
 */
const isZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

/** A user's display preferences, as stored. */
export const PreferencesSchema = z.object({
  /** An IANA zone name, or null to use the browser's. */
  timezone: z.string().max(64).refine(isZone, "Unknown time zone").nullable(),
  /** "h12", "h23", or null to let the locale decide. */
  hourCycle: z.enum(["h12", "h23"]).nullable(),
});

/** A user's display preferences. */
export type Preferences = z.infer<typeof PreferencesSchema>;

/** Everything from the browser: no stored zone, no stored hour cycle. */
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({
  timezone: null,
  hourCycle: null,
});

/**
 * @function parsePreferences
 * @param raw {unknown} the stored string, or anything else (a missing field, undefined)
 * @returns {Preferences} the parsed value, or DEFAULT_PREFERENCES when raw isn't a string, isn't
 *          JSON, or fails the schema (an unknown zone or a bad hour cycle)
 */
export const parsePreferences = (raw: unknown): Preferences => {
  if (typeof raw !== "string") return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = PreferencesSchema.partial().safeParse(JSON.parse(raw));
    if (!parsed.success) return { ...DEFAULT_PREFERENCES };
    return { timezone: parsed.data.timezone ?? null, hourCycle: parsed.data.hourCycle ?? null };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

/**
 * @function serializePreferences
 * @param p {Preferences} valid preferences
 * @returns {string} the stored form, after validating p against PreferencesSchema
 * @throws {z.ZodError} when p doesn't match PreferencesSchema (an unknown zone, say)
 */
export const serializePreferences = (p: Preferences): string =>
  JSON.stringify(PreferencesSchema.parse(p));
