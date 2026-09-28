/**
 * @file src/testing/index.ts
 * @desc @haruhimemoe/next-kit/testing: Vitest helpers both apps shared. One in-memory MongoDB per
 *       run (a globalSetup) and per-file collection clearing, an msw server that refuses unhandled
 *       requests, and a fake osu! app env. Needs vitest, and msw or mongodb-memory-server for
 *       their helpers. Never import it from app code.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export { stubEnv, stubOsuAppEnv, TEST_OSU_APP_ENV } from "./env.js";
export {
  BETTER_AUTH_COLLECTIONS,
  setupTestDb,
  startMemoryMongo,
  type TestDbOptions,
} from "./mongo.js";
export { setupMsw } from "./msw.js";
