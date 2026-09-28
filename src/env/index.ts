/**
 * @file src/env/index.ts
 * @desc @haruhimemoe/next-kit/env: zod env parsing with SKIP_ENV_VALIDATION and the production
 *       placeholder guard, the osu! app's five variables, and per-call readers for optional
 *       secrets, id lists, flags and origins. Server only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export { EnvError, invalidEnv } from "./errors.js";
export {
  optionalSecret,
  readFlag,
  readIdSet,
  readOptional,
  readOrigin,
} from "./optional.js";
export {
  OSU_APP_PLACEHOLDERS,
  OSU_APP_SECRET_KEYS,
  type OsuAppEnv,
  osuAppEnvSchema,
} from "./osu-app.js";
export {
  BUILD_PHASE,
  createServerEnv,
  type EnvSchema,
  type EnvSource,
  isEnvValidationSkipped,
  isProductionServer,
  type ServerEnv,
  type ServerEnvOptions,
} from "./server-env.js";
