/**
 * @file src/server/index.ts
 * @desc @haruhimemoe/next-kit/server: route handler helpers. JSON errors and headers, the body
 *       parser and id lists, the cross-site guard, the client IP and its rate-limit subject,
 *       fixed-window rate limits and call budgets in MongoDB, bearer machine auth, where to go
 *       after sign-in, and security.txt. Server only: machine-auth loads node:crypto.
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
export { type Budget, type BudgetOptions, createBudget } from "./budget.js";
export { clientIp, MAX_IP_LENGTH, rateLimitSubject } from "./client-ip.js";
export {
  COUNTER_GRACE_MS,
  type CounterDoc,
  type CounterStore,
  counterTtlIndex,
  RATE_LIMITS_COLLECTION,
  type RateLimitRule,
  type RateLimitWindow,
  rateLimitId,
  windowFor,
} from "./counter.js";
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
  type BearerFailureLimit,
  type BearerGuardOptions,
  bearerToken,
  refuseWithoutBearer,
  sameSecret,
} from "./machine-auth.js";
export {
  createRateLimiter,
  type RateLimiter,
  type RateLimiterOptions,
  type RateLimitResult,
  rateLimitHeaders,
  retryText,
  tooManyRequests,
  unlimited,
  userSubject,
} from "./rate-limit.js";
export {
  DEFAULT_SIGN_IN_PATH,
  type HubSignInUrlOptions,
  hubSignInUrl,
  MAX_NEXT_LENGTH,
  type SafeAbsoluteNextOptions,
  type SafeNextOptions,
  safeAbsoluteNext,
  safeNextPath,
  signInHref,
} from "./safe-next.js";
export {
  buildSecurityTxt,
  SECURITY_TXT_LIFETIME_DAYS,
  SECURITY_TXT_PATH,
  type SecurityTxtOptions,
} from "./security-txt.js";
