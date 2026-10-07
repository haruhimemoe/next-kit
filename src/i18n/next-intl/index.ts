/**
 * @file src/i18n/next-intl/index.ts
 * @desc @haruhimemoe/next-kit/i18n/next-intl: the request config and the locale middleware.
 *       Imports next-intl statically, so install next-intl (an optional peer) before using it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

export { createI18nMiddleware, type I18nMiddlewareOptions } from "./middleware.js";
export {
  createRequestConfig,
  type Messages,
  type MessagesLoader,
  mergeMessages,
  type RequestConfigOptions,
  resolveRequestConfig,
} from "./request-config.js";
