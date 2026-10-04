/**
 * @file src/api-keys/index.ts
 * @desc @haruhimemoe/next-kit/api-keys: the API key format every haruhime app shares (an app
 *       prefix like hpk_ plus 32 random bytes), the key store over api_keys, and the /api/v1
 *       guard with the standard limits. Server only: loads node:crypto and mongodb.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

export {
  API_KEY_BYTES,
  API_KEY_DISPLAY_LENGTH,
  API_KEY_PREFIX_PATTERN,
  apiKeyDisplay,
  apiKeyToken,
  assertApiKeyPrefix,
  generateApiKey,
  hashApiKey,
  isApiKeyFormat,
} from "./format.js";
export {
  API_LIMITS,
  API_SERVER_ERROR,
  type ApiKeyGuardOptions,
  type ApiLimits,
  createApiKeyGuard,
} from "./guard.js";
export {
  API_KEYS_COLLECTION,
  type ApiKeyCreated,
  type ApiKeyInfo,
  type ApiKeyMatch,
  type ApiKeyStore,
  type ApiKeyStoreOptions,
  apiKeyIndexSpecs,
  createApiKeyStore,
  LAST_USED_INTERVAL_MS,
} from "./store.js";
