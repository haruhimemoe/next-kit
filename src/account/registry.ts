/**
 * @file src/account/registry.ts
 * @desc The hub's static list of satellite apps (bb, packs, pools) for account fan-out and the
 *       inbox: each app's id, name, base URL and the env var holding its shared secret. A secret
 *       shorter than 32 bytes counts as unset. Only https base URLs are called (http only for
 *       localhost in dev), so a misconfigured registry can't send a bearer in the clear.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/** One satellite app the hub calls. */
export type AccountApp = {
  /** Short id, like "packs"; keys the export bundle. */
  id: string;
  /** Shown to people, like "packs.haruhime.moe". */
  name: string;
  /** The app's origin, like "https://packs.haruhime.moe". */
  baseUrl: string;
  /** The env var holding the app's shared secret, like "ACCOUNT_SECRET_PACKS". */
  secretEnv: string;
};

/** What the hub asks every app to do with one user's data. */
export type AccountOp = "export" | "delete";

/** Shorter secrets count as unset. */
export const MIN_ACCOUNT_SECRET_BYTES = 32;

/** The path each satellite serves its account handlers under. */
export const ACCOUNT_PATH = "/api/internal/account";

/** A 24-hex MongoDB ObjectId string, the identity user id every app keys its data on. */
export const USER_ID_PATTERN = /^[0-9a-f]{24}$/;

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * @function usableSecret
 * @param value {string | undefined} a configured secret
 * @returns {string | undefined} the secret when it's at least 32 bytes, else undefined
 */
export const usableSecret = (value: string | undefined): string | undefined =>
  value !== undefined && Buffer.byteLength(value, "utf8") >= MIN_ACCOUNT_SECRET_BYTES
    ? value
    : undefined;

/**
 * @function secretFor
 * @param app {AccountApp} a registered app
 * @param env {Record<string, string | undefined>} where secrets live (process.env)
 * @returns {string | undefined} the app's secret, or undefined when unset or too short
 */
export const secretFor = (
  app: AccountApp,
  env: Record<string, string | undefined>,
): string | undefined => usableSecret(env[app.secretEnv]);

/**
 * @function appUrl
 * @param app {AccountApp} a registered app
 * @param path {string} an absolute path on it
 * @returns {URL | null} the URL, or null when baseUrl isn't https (or http on localhost)
 */
export const appUrl = (app: AccountApp, path: string): URL | null => {
  let base: URL;
  try {
    base = new URL(app.baseUrl);
  } catch {
    return null;
  }
  const secure =
    base.protocol === "https:" || (base.protocol === "http:" && LOCAL_HOSTS.has(base.hostname));
  return secure ? new URL(path, base.origin) : null;
};
