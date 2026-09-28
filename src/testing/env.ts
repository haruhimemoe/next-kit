/**
 * @file src/testing/env.ts
 * @desc Fake env for tests: a complete, valid set of the osu! app's five variables (no real
 *       secrets) and stubEnv, which puts values in process.env through Vitest (undo with
 *       vi.unstubAllEnvs). Moved from packs and pools (tests/helpers/server-env.ts, identical).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { vi } from "vitest";

/** A complete, valid osu! app env. MONGODB_URI equals the placeholder; tests replace it. */
export const TEST_OSU_APP_ENV = Object.freeze({
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  BETTER_AUTH_SECRET: "t8Vq2Lm5Xr9Kc1Wz4Hn7Pb3Jd6Fs0Gy2Qe5R",
  BETTER_AUTH_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "1",
  OSU_CLIENT_SECRET: "test-osu-client-secret",
});

/**
 * @function stubEnv
 * @param values {Record<string, string>} variables to set
 * @returns {void} stubs each into process.env with vi.stubEnv
 */
export const stubEnv = (values: Record<string, string>): void => {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
};

/**
 * @function stubOsuAppEnv
 * @param overrides {Record<string, string>} values to change or add
 * @returns {void} stubs TEST_OSU_APP_ENV, with the overrides, into process.env
 */
export const stubOsuAppEnv = (overrides: Record<string, string> = {}): void =>
  stubEnv({ ...TEST_OSU_APP_ENV, ...overrides });
