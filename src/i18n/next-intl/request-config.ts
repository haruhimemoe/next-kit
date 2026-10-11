/**
 * @file src/i18n/next-intl/request-config.ts
 * @desc next-intl's request config for an app's i18n/request.ts: the locale (the matched
 *       segment, then the NEXT_LOCALE cookie, then the user's saved locale, then Accept-Language,
 *       then the default) and the messages, package
 *       catalogs first and the app's own last, merged deeply so later wins. Loaders are injected
 *       so the bundler sees each import("./messages/<locale>.json").
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Sun Oct 11, 2026
 */

import { getRequestConfig } from "next-intl/server";
import { hasLocale, type LocaleConfig } from "../locales.js";
import { negotiateLocale } from "../negotiate.js";

/** A message catalog: nested objects of strings. */
export type Messages = Record<string, unknown>;
/** Loads one catalog for a locale, like (locale) => import(`./messages/${locale}.json`). */
export type MessagesLoader = (locale: string) => Promise<Messages>;

/** createRequestConfig's input. */
export type RequestConfigOptions = {
  config: LocaleConfig;
  /** The app's own messages; they win over every package catalog. */
  app: MessagesLoader;
  /** Package catalogs (<pkg>/messages/<locale>.json), merged in order before the app's. */
  packages?: readonly MessagesLoader[];
  /** The signed-in user's saved locale, used when no locale segment matched. */
  userLocale?: () => Promise<string | null>;
  /**
   * The request's NEXT_LOCALE cookie and Accept-Language header, for apps without locale
   * segments (prefix-less routing). Pass readRequestLocale from this subpath.
   */
  request?: () => Promise<RequestLocaleHints>;
};

/** What a prefix-less app reads off the request to pick a locale. */
export type RequestLocaleHints = { cookie: string | null; acceptLanguage: string | null };

/**
 * @function readRequestLocale
 * @returns {Promise<RequestLocaleHints>} the NEXT_LOCALE cookie and Accept-Language header of
 *          the current request, read through next/headers
 */
export const readRequestLocale = async (): Promise<RequestLocaleHints> => {
  const { cookies, headers } = await import("next/headers.js");
  const [jar, list] = await Promise.all([cookies(), headers()]);
  return {
    cookie: jar.get("NEXT_LOCALE")?.value ?? null,
    acceptLanguage: list.get("accept-language"),
  };
};

const isObject = (value: unknown): value is Messages =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @function mergeMessages
 * @param catalogs {Messages[]} catalogs in order
 * @returns {Messages} one catalog; nested objects merge, any other value from a later catalog
 *          replaces the earlier one. Inputs are not changed.
 */
export const mergeMessages = (...catalogs: Messages[]): Messages => {
  const out: Messages = {};
  for (const catalog of catalogs) {
    for (const [key, value] of Object.entries(catalog)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      const prev = out[key];
      out[key] = isObject(prev) && isObject(value) ? mergeMessages(prev, value) : value;
    }
  }
  return out;
};

/**
 * @function resolveRequestConfig
 * @param options {RequestConfigOptions} the app's locales and loaders
 * @param requested {string | undefined} the locale next-intl matched for the request
 * @returns {Promise<{ locale: string; messages: Messages }>} what createRequestConfig hands
 *          next-intl (exported for tests and custom configs)
 */
export const resolveRequestConfig = async (
  options: RequestConfigOptions,
  requested: string | undefined,
): Promise<{ locale: string; messages: Messages }> => {
  const { config } = options;
  let locale = config.defaultLocale;
  if (hasLocale(config, requested)) locale = requested;
  else {
    const hints = options.request ? await options.request() : null;
    const cookie = hints?.cookie;
    if (hasLocale(config, cookie)) locale = cookie;
    else {
      const saved = options.userLocale ? await options.userLocale() : null;
      locale = negotiateLocale(config, hints?.acceptLanguage ?? null, saved);
    }
  }
  const loaders = [...(options.packages ?? []), options.app];
  const catalogs = await Promise.all(loaders.map((load) => load(locale)));
  return { locale, messages: mergeMessages(...catalogs) };
};

/**
 * @function createRequestConfig
 * @param options {RequestConfigOptions} the app's locales and loaders
 * @returns the default export for the app's i18n/request.ts
 */
export const createRequestConfig = (options: RequestConfigOptions) =>
  getRequestConfig(async ({ requestLocale }) => resolveRequestConfig(options, await requestLocale));
