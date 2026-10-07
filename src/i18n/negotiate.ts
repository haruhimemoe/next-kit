/**
 * @file src/i18n/negotiate.ts
 * @desc Picks a request's locale: the user's saved identity locale, then the Accept-Language
 *       header in q-order (with a region fallback, ja-JP to ja), then the default. The header is
 *       capped before parsing (1 KB, 20 entries), so a huge header costs nothing. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { hasLocale, type LocaleConfig } from "./locales.js";

/** Accept-Language past this many characters is cut before parsing. */
export const ACCEPT_LANGUAGE_MAX_LENGTH = 1024;
/** Only this many comma-separated entries are read. */
export const ACCEPT_LANGUAGE_MAX_ENTRIES = 20;

const TAG = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$|^\*$/;
const Q = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i;

type Range = { tag: string; q: number; order: number };

/** Parses the capped header into ranges, best first; malformed entries are skipped. */
const ranges = (header: string): Range[] => {
  const out: Range[] = [];
  const entries = header.slice(0, ACCEPT_LANGUAGE_MAX_LENGTH).split(",");
  for (const [order, entry] of entries.slice(0, ACCEPT_LANGUAGE_MAX_ENTRIES).entries()) {
    const [rawTag = "", ...params] = entry.split(";").map((part) => part.trim());
    if (!TAG.test(rawTag)) continue;
    let q = 1;
    let valid = true;
    for (const param of params) {
      if (!/^q=/i.test(param)) continue;
      const found = Q.exec(param);
      if (found) q = Number(found[1]);
      else valid = false;
    }
    if (valid && q > 0) out.push({ tag: rawTag.toLowerCase(), q, order });
  }
  return out.sort((a, b) => b.q - a.q || a.order - b.order);
};

/** The app locale a range names: exact (case-insensitive), then its primary subtag. */
const match = (config: LocaleConfig, tag: string): string | undefined => {
  const exact = config.locales.find((locale) => locale.toLowerCase() === tag);
  if (exact) return exact;
  const primary = tag.split("-")[0];
  return config.locales.find((locale) => locale.toLowerCase() === primary);
};

/**
 * @function negotiateLocale
 * @param config {LocaleConfig} the app's locales
 * @param acceptLanguage {string | null} the request's Accept-Language header
 * @param userLocale {string | null} the signed-in user's saved identity locale, if any
 * @returns {string} the user's locale when the app serves it, else the best header match, else
 *          the default ("*" also means the default)
 */
export const negotiateLocale = (
  config: LocaleConfig,
  acceptLanguage: string | null,
  userLocale?: string | null,
): string => {
  if (hasLocale(config, userLocale)) return userLocale;
  for (const range of ranges(acceptLanguage ?? "")) {
    if (range.tag === "*") return config.defaultLocale;
    const found = match(config, range.tag);
    if (found) return found;
  }
  return config.defaultLocale;
};
