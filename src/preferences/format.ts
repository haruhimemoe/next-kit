/**
 * @file src/preferences/format.ts
 * @desc formatInstant: the one place an ISO instant becomes the string a page shows, given a
 *       resolved time zone and an hour cycle. hourCycle null leaves Intl's hourCycle option out
 *       entirely, so the locale's own convention decides (never forced to h23).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

/** What formatInstant needs: a resolved zone and an hour cycle (null: the locale's own). */
export type FormatPrefs = { timeZone: string; hourCycle: "h12" | "h23" | null };

/**
 * @function formatInstant
 * @param iso {string} an instant
 * @param prefs {FormatPrefs} the resolved zone and hour cycle
 * @param style {"time" | "day"} "Tue, Nov 3, 15:00" (default) or "Tue, Nov 3"
 * @returns {string} the formatted instant
 */
export const formatInstant = (
  iso: string,
  prefs: FormatPrefs,
  style: "time" | "day" = "time",
): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: prefs.timeZone,
    ...(style === "time"
      ? {
          hour: "2-digit",
          minute: "2-digit",
          ...(prefs.hourCycle ? { hourCycle: prefs.hourCycle } : {}),
        }
      : {}),
  }).format(new Date(iso));
