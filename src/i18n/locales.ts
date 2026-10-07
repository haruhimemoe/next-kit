/**
 * @file src/i18n/locales.ts
 * @desc An app's locale list and the guard that checks a value against it. Pure: no next-intl.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/** The locales every haruhime app ships today: English only. */
export const DEFAULT_LOCALES = ["en"] as const;

/** The locales an app serves and the one it falls back to (which must be in the list). */
export type LocaleConfig = { locales: readonly string[]; defaultLocale: string };

/**
 * @function hasLocale
 * @param config {LocaleConfig} the app's locales
 * @param value {unknown} a cookie, a path segment, a saved user field
 * @returns {boolean} true when value is exactly one of the app's locales
 */
export const hasLocale = (config: LocaleConfig, value: unknown): value is string =>
  typeof value === "string" && config.locales.includes(value);
