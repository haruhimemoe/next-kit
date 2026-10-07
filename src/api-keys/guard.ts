/**
 * @file src/api-keys/guard.ts
 * @desc The /api/v1 guard every haruhime app uses: looks the Bearer key up; a missing or bad key
 *       counts against the caller's IP (auth-fail, 429 past it) and answers 401 with
 *       WWW-Authenticate: Bearer; a good key counts per user (api, and api-write for writes),
 *       showing whichever runs out first. Every answer gets RateLimit-* headers and no-store, a
 *       thrown error included (JSON 500). No CORS headers: the API is for servers and bots.
 *       Moved from packs (src/lib/api-auth.ts) with the user lookup and messages passed in.
 *       0.13: withApiKey(handler, { scope }) answers 403 insufficient_scope to a key without it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Tue Oct 6, 2026
 */

import { clientIp, rateLimitSubject } from "../server/client-ip.js";
import type { RateLimitRule } from "../server/counter.js";
import { jsonError, withHeaders } from "../server/errors.js";
import {
  type RateLimiter,
  type RateLimitResult,
  rateLimitHeaders,
  tooManyRequests,
  unlimited,
} from "../server/rate-limit.js";
import { apiKeyToken } from "./format.js";
import { hasScope } from "./scopes.js";
import type { ApiKeyStore } from "./store.js";

/** The standard limits every haruhime API uses (fixed windows). */
export const API_LIMITS = {
  /** Every /api/v1 request, per user. */
  api: { scope: "api", limit: 60, windowSeconds: 60 },
  /** POST/PUT/PATCH/DELETE on /api/v1, per user (also counted by api). */
  apiWrite: { scope: "api-write", limit: 10, windowSeconds: 60 },
  /** Missing, bad or revoked keys, per IP. */
  authFail: { scope: "auth-fail", limit: 20, windowSeconds: 60 },
  /** Creating or regenerating a key on the account page, per user. */
  keyCreate: { scope: "key-create", limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/** The rules the guard counts. */
export type ApiLimits = { api: RateLimitRule; apiWrite: RateLimitRule; authFail: RateLimitRule };

/** The 500 message when a key lookup or handler throws. */
export const API_SERVER_ERROR = "Something went wrong on our end. Try again in a minute.";

/** The 403 message when a key lacks the scope a handler needs. */
export const API_INSUFFICIENT_SCOPE = "This API key doesn't have the scope this request needs.";

/** Per-handler options: the scope a key needs (any scope when unset). */
export type ApiKeyHandlerOptions = { scope?: string };

/** createApiKeyGuard's options. */
export type ApiKeyGuardOptions<Caller> = {
  store: Pick<ApiKeyStore, "authenticate">;
  limiter: Pick<RateLimiter, "hit">;
  /** Who a key's user is; null for a deleted or system account (answers 401). */
  resolveCaller: (userId: string) => Promise<Caller | null>;
  /** missing: no key sent (name the prefix); invalid: a bad, revoked or replaced key. */
  messages: { missing: string; invalid: string; serverError?: string; insufficientScope?: string };
  limits?: ApiLimits;
  now?: () => number;
};

const WRITE_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const finish = (response: Response, limit: RateLimitResult): Response =>
  withHeaders(response, { ...rateLimitHeaders(limit), "Cache-Control": "no-store" });

/**
 * @function createApiKeyGuard
 * @param options {ApiKeyGuardOptions<Caller>} store, limiter, caller lookup, messages
 * @returns {Function} withApiKey(handler, { scope }): a route handler that runs
 *          handler(request, caller, context) only for a good key under its limits (and with
 *          the scope, when one is given)
 */
export const createApiKeyGuard = <Caller extends { id: string }>({
  store,
  limiter,
  resolveCaller,
  messages,
  limits = API_LIMITS,
  now = () => Date.now(),
}: ApiKeyGuardOptions<Caller>) => {
  /** Nothing counted yet (the key lookup threw): the per-user limit, untouched. */
  const uncounted = (): RateLimitResult => unlimited(limits.api, now());
  const serverError = (error: unknown, limit: RateLimitResult): Response => {
    console.error("api: request failed", error);
    return finish(jsonError(500, messages.serverError ?? API_SERVER_ERROR), limit);
  };
  const lookUp = async (
    token: string | null,
  ): Promise<{ caller: Caller; scopes: string[] } | null> => {
    const match = token ? await store.authenticate(token) : null;
    const caller = match ? await resolveCaller(match.userId) : null;
    if (!match || !caller) return null;
    // Stamp only a key whose owner checks out (packs' order).
    await match.stamp();
    return { caller, scopes: match.scopes };
  };

  return <C = unknown>(
    handler: (request: Request, caller: Caller, context: C) => Promise<Response>,
    { scope }: ApiKeyHandlerOptions = {},
  ) =>
    async (request: Request, context: C): Promise<Response> => {
      const token = apiKeyToken(request.headers);
      let found: { caller: Caller; scopes: string[] } | null;
      try {
        found = await lookUp(token);
      } catch (error) {
        return serverError(error, uncounted());
      }
      if (!found) {
        const failures = await limiter.hit(
          limits.authFail,
          rateLimitSubject(clientIp(request.headers)),
        );
        if (!failures.allowed) return finish(tooManyRequests(failures), failures);
        const body = token
          ? jsonError(401, messages.invalid, "invalid_api_key")
          : jsonError(401, messages.missing);
        return finish(withHeaders(body, { "WWW-Authenticate": "Bearer" }), failures);
      }
      const { caller, scopes } = found;
      const requests = await limiter.hit(limits.api, caller.id);
      if (!requests.allowed) return finish(tooManyRequests(requests), requests);
      let shown = requests;
      if (WRITE_METHODS.has(request.method)) {
        const writes = await limiter.hit(limits.apiWrite, caller.id);
        if (!writes.allowed) return finish(tooManyRequests(writes), writes);
        // Show whichever counter runs out first.
        if (writes.remaining < requests.remaining) shown = writes;
      }
      if (scope !== undefined && !hasScope(scopes, scope)) {
        const message = messages.insufficientScope ?? API_INSUFFICIENT_SCOPE;
        return finish(jsonError(403, message, "insufficient_scope"), shown);
      }
      try {
        return finish(await handler(request, caller, context), shown);
      } catch (error) {
        return serverError(error, shown);
      }
    };
};
