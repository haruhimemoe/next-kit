/**
 * @file src/env/optional.ts
 * @desc Variables read on every call instead of memoized with the server env, so a missing or
 *       bad value only breaks what uses it and a change applies at the next request (a removed
 *       admin id stops working at once): optional secrets, osu! id lists, flags and origins.
 *       Moved from packs (optionalSecret: CRON_SECRET, POOLS_SERVICE_TOKEN) and pools
 *       (getAdminOsuIds, getAllowSharedDbUser, the PACKS_URL check).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { invalidEnv } from "./errors.js";
import type { EnvSource } from "./server-env.js";

/**
 * @function readOptional
 * @param key {string} the variable
 * @param source {EnvSource} usually process.env (the default)
 * @returns {string | undefined} its value, trimmed; undefined when unset or blank
 */
export const readOptional = (key: string, source: EnvSource = process.env): string | undefined =>
  source[key]?.trim() || undefined;

/**
 * @function optionalSecret
 * @param key {string} the variable
 * @param minLength {number} the shortest secret accepted
 * @param source {EnvSource} usually process.env (the default)
 * @returns {string | undefined} the secret, trimmed; undefined when unset (whatever needs it then
 *          refuses every call)
 * @throws {EnvError} naming (never printing) the variable when it's set but too short
 */
export const optionalSecret = (
  key: string,
  minLength: number,
  source: EnvSource = process.env,
): string | undefined => {
  const value = readOptional(key, source);
  if (value !== undefined && value.length < minLength) throw invalidEnv([key]);
  return value;
};

const ID_LIST = /^\d+(\s*,\s*\d+)*$/;

/**
 * @function readIdSet
 * @param key {string} the variable, like ADMIN_OSU_IDS
 * @param source {EnvSource} usually process.env (the default)
 * @returns {ReadonlySet<number>} the comma-separated ids (spaces allowed around commas); empty
 *          when unset
 * @throws {EnvError} naming (never printing) the variable when it isn't an id list
 */
export const readIdSet = (key: string, source: EnvSource = process.env): ReadonlySet<number> => {
  const raw = readOptional(key, source);
  if (raw === undefined) return new Set();
  if (!ID_LIST.test(raw)) throw invalidEnv([key]);
  return new Set(raw.split(",").map((part) => Number(part.trim())));
};

/**
 * @function readFlag
 * @param key {string} the variable
 * @param source {EnvSource} usually process.env (the default)
 * @returns {boolean} true only when it's "true" (trimmed); unset, blank or anything else is false
 */
export const readFlag = (key: string, source: EnvSource = process.env): boolean =>
  readOptional(key, source) === "true";

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

/**
 * @function readOrigin
 * @param key {string} the variable, like PACKS_URL
 * @param fallback {string} the origin when it's unset
 * @param source {EnvSource} usually process.env (the default)
 * @returns {string} an origin (no path, query or hash): https, or http on localhost
 * @throws {EnvError} naming (never printing) the variable when it's anything else
 */
export const readOrigin = (
  key: string,
  fallback: string,
  source: EnvSource = process.env,
): string => {
  const raw = readOptional(key, source);
  if (raw === undefined) return fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalidEnv([key]);
  }
  const secure =
    url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw invalidEnv([key]);
  }
  return url.origin;
};
