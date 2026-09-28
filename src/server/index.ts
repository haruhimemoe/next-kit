/**
 * @file src/server/index.ts
 * @desc @haruhimemoe/next-kit/server: route handler helpers. JSON errors and headers, the body
 *       parser and id lists, the cross-site guard, the client IP and its rate-limit subject,
 *       where to go after sign-in, and security.txt.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export {
  MAX_BODY_BYTES,
  MAX_ID,
  type ParsedBody,
  type ParseIdListOptions,
  type ParseJsonBodyOptions,
  parseIdList,
  parseJsonBody,
} from "./body.js";
export { clientIp, MAX_IP_LENGTH, rateLimitSubject } from "./client-ip.js";
export { type CrossSiteOptions, crossSiteMessage, refuseCrossSite } from "./cross-site.js";
export {
  type ApiErrorBody,
  ERROR_CODES,
  errorCodeFor,
  jsonError,
  noStore,
  withHeaders,
} from "./errors.js";
export {
  DEFAULT_SIGN_IN_PATH,
  MAX_NEXT_LENGTH,
  type SafeNextOptions,
  safeNextPath,
  signInHref,
} from "./safe-next.js";
export {
  buildSecurityTxt,
  SECURITY_TXT_LIFETIME_DAYS,
  SECURITY_TXT_PATH,
  type SecurityTxtOptions,
} from "./security-txt.js";
