/**
 * @file tests/preferences/preferences.test.ts
 * @desc parsePreferences, serializePreferences and formatInstant: a stored string round-trips,
 *       junk, unknown zones and missing values fall back to DEFAULT_PREFERENCES, and the hour
 *       cycle controls the formatted time (h23, h12, and day-only with no hour at all).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  formatInstant,
  parsePreferences,
  serializePreferences,
} from "../../src/preferences/index.js";

describe("preferences", () => {
  it("parses a stored string", () => {
    expect(parsePreferences('{"timezone":"Asia/Tokyo","hourCycle":"h12"}')).toEqual({
      timezone: "Asia/Tokyo",
      hourCycle: "h12",
    });
  });

  it("falls back on junk, unknown zones and missing values", () => {
    expect(parsePreferences("not json")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"timezone":"Mars/Base"}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips", () => {
    const p = { timezone: "Europe/Berlin", hourCycle: "h23" as const };
    expect(parsePreferences(serializePreferences(p))).toEqual(p);
  });

  it("formats with the hour cycle", () => {
    const at = "2026-11-03T15:00:00.000Z";
    expect(formatInstant(at, { timeZone: "UTC", hourCycle: "h23" })).toBe("Tue, Nov 3, 15:00");
    expect(formatInstant(at, { timeZone: "UTC", hourCycle: "h23", locale: "ja" })).toMatch(
      /11月3日/,
    );
    expect(formatInstant(at, { timeZone: "UTC", hourCycle: "h12" })).toBe("Tue, Nov 3, 03:00 PM");
    expect(formatInstant(at, { timeZone: "Asia/Tokyo", hourCycle: "h23" }, "day")).toBe(
      "Wed, Nov 4",
    );
  });
});
