/**
 * @file src/api-keys/format.ts
 * @desc The haruhime API key format: an app prefix ("h" + two letters + "_", like hpk_ for packs)
 *       plus 32 random bytes in base64url. Only the SHA-256 hex digest is stored; the first 12
 *       characters are kept for display. Moved from packs (src/lib/api-key.ts) with the prefix
 *       passed in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { createHash, randomBytes } from "node:crypto";

/** Random bytes in a key: 43 base64url characters. */
export const API_KEY_BYTES = 32;
/** Characters of a key shown on account pages and in data exports (prefix + 8). */
export const API_KEY_DISPLAY_LENGTH = 12;
/** Every app prefix: "h", two lowercase letters, "_". */
export const API_KEY_PREFIX_PATTERN = /^h[a-z]{2}_$/;

const SECRET_LENGTH = Math.ceil((API_KEY_BYTES * 4) / 3);
const SECRET = new RegExp(`^[A-Za-z0-9_-]{${SECRET_LENGTH}}$`);
const BEARER = /^Bearer[ \t]+(\S+)$/i;

/**
 * @function assertApiKeyPrefix
 * @param prefix {string} an app prefix, like "hpl_"
 * @returns {void}
 * @throws {TypeError} when the prefix isn't "h" + two lowercase letters + "_"
 */
export const assertApiKeyPrefix = (prefix: string): void => {
  if (!API_KEY_PREFIX_PATTERN.test(prefix)) {
    throw new TypeError(`API key prefix must look like "hpk_", got ${JSON.stringify(prefix)}`);
  }
};

/**
 * @function generateApiKey
 * @param prefix {string} the app prefix
 * @returns {string} a new key; show it once and store only hashApiKey(key)
 * @throws {TypeError} on a bad prefix
 */
export const generateApiKey = (prefix: string): string => {
  assertApiKeyPrefix(prefix);
  return `${prefix}${randomBytes(API_KEY_BYTES).toString("base64url")}`;
};

/**
 * @function hashApiKey
 * @param key {string} a full key
 * @returns {string} its SHA-256 hex digest
 */
export const hashApiKey = (key: string): string =>
  createHash("sha256").update(key, "utf8").digest("hex");

/**
 * @function apiKeyDisplay
 * @param key {string} a full key
 * @returns {string} its first API_KEY_DISPLAY_LENGTH characters
 */
export const apiKeyDisplay = (key: string): string => key.slice(0, API_KEY_DISPLAY_LENGTH);

/**
 * @function isApiKeyFormat
 * @param prefix {string} the app prefix
 * @param value {string} an untrusted token
 * @returns {boolean} true only for this prefix plus 43 base64url characters
 */
export const isApiKeyFormat = (prefix: string, value: string): boolean =>
  value.startsWith(prefix) && SECRET.test(value.slice(prefix.length));

/**
 * @function apiKeyToken
 * @param headers {Headers} request headers
 * @returns {string | null} the single token after "Bearer " (any case, extra spaces ignored),
 *          or null
 */
export const apiKeyToken = (headers: Headers): string | null =>
  BEARER.exec(headers.get("authorization")?.trim() ?? "")?.[1] ?? null;
