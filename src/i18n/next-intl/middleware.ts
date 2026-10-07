/**
 * @file src/i18n/next-intl/middleware.ts
 * @desc The locale middleware: next-intl's createMiddleware with the "as-needed" prefix (the
 *       default locale has no prefix) and the NEXT_LOCALE cookie, on the parent domain when
 *       cookieDomain is set so every haruhime app shares it. An app's own next function runs
 *       after locale handling. No Mongo, no rate limits: it runs in the edge runtime, and those
 *       checks stay in route handlers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { NextRequest } from "next/server.js";
import createMiddleware from "next-intl/middleware";
import type { LocaleConfig } from "../locales.js";

/** createI18nMiddleware's input. */
export type I18nMiddlewareOptions = {
  config: LocaleConfig;
  /** Like ".haruhime.moe": the NEXT_LOCALE cookie's domain. Host-only when unset. */
  cookieDomain?: string;
  /**
   * Runs after locale handling unless next-intl redirected, with next-intl's response (which
   * may carry its rewrite and the NEXT_LOCALE cookie). A Response it returns is sent instead,
   * with next-intl's Set-Cookie headers copied onto it; undefined keeps next-intl's.
   */
  next?: (
    req: NextRequest,
    response: Response,
  ) => Response | undefined | Promise<Response | undefined>;
};

/**
 * @function createI18nMiddleware
 * @param options {I18nMiddlewareOptions} the app's locales, the cookie domain and its own step
 * @returns {(req: NextRequest) => Promise<Response>} the app's middleware (proxy) function
 */
export const createI18nMiddleware = (
  options: I18nMiddlewareOptions,
): ((req: NextRequest) => Promise<Response>) => {
  const { locales, defaultLocale } = options.config;
  const intl = createMiddleware({
    locales,
    defaultLocale,
    localePrefix: "as-needed",
    localeCookie:
      options.cookieDomain === undefined
        ? { name: "NEXT_LOCALE" }
        : {
            name: "NEXT_LOCALE",
            domain: options.cookieDomain,
          },
  });
  return async (req) => {
    const response = intl(req);
    if (response.status >= 300 && response.status < 400) return response;
    const own = await options.next?.(req, response);
    if (!own || own === response) return response;
    for (const cookie of response.headers.getSetCookie()) own.headers.append("set-cookie", cookie);
    return own;
  };
};
