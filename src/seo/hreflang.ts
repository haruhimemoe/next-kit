/**
 * @file src/seo/hreflang.ts
 * @desc hreflang alternates for a page served in several locales, matching the i18n middleware's
 *       "as-needed" prefix: the default locale has no prefix, every other one is /<locale>/...,
 *       and x-default points at the default. Types only from i18n, so seo still loads nothing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { LocaleConfig } from "../i18n/locales.js";

/**
 * @function hreflangAlternates
 * @param config {LocaleConfig} the app's locales
 * @param path {string} the page's unprefixed path, like "/search"
 * @param baseUrl {string} the site's origin, like "https://www.haruhime.moe"
 * @returns {Record<string, string>} { en: url, ja: url, "x-default": url }, for pageMetadata's
 *          alternates.languages
 * @throws {Error} when path doesn't start with "/"
 */
export const hreflangAlternates = (
  config: LocaleConfig,
  path: string,
  baseUrl: string,
): Record<string, string> => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`hreflangAlternates: path must start with "/" (got ${JSON.stringify(path)})`);
  }
  const origin = new URL(baseUrl).origin;
  const url = (locale: string) =>
    locale === config.defaultLocale
      ? `${origin}${path}`
      : `${origin}/${locale}${path === "/" ? "" : path}`;
  const languages: Record<string, string> = {};
  for (const locale of config.locales) languages[locale] = url(locale);
  languages["x-default"] = url(config.defaultLocale);
  return languages;
};
