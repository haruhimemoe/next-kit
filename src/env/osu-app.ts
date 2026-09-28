/**
 * @file src/env/osu-app.ts
 * @desc The five variables a Next app with MongoDB and osu! sign-in needs (the same block in
 *       packs' and pools' src/env.ts), their SKIP_ENV_VALIDATION placeholders and which are
 *       secrets. Pass them to createServerEnv, or extend the schema first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { z } from "zod";

/** MONGODB_URI, BETTER_AUTH_SECRET (32+), BETTER_AUTH_URL, OSU_CLIENT_ID (digits), OSU_CLIENT_SECRET. */
export const osuAppEnvSchema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  OSU_CLIENT_ID: z.string().regex(/^\d+$/),
  OSU_CLIENT_SECRET: z.string().min(1),
});

/** The validated variables. */
export type OsuAppEnv = z.infer<typeof osuAppEnvSchema>;

/** Used only under SKIP_ENV_VALIDATION=true. Nothing connects with these. */
export const OSU_APP_PLACEHOLDERS: Readonly<OsuAppEnv> = Object.freeze({
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  BETTER_AUTH_SECRET: "skip-env-validation-placeholder-secret-000",
  BETTER_AUTH_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "0",
  OSU_CLIENT_SECRET: "placeholder",
});

/** The variables whose placeholder would be a known secret on a production server. */
export const OSU_APP_SECRET_KEYS = Object.freeze([
  "BETTER_AUTH_SECRET",
  "OSU_CLIENT_SECRET",
  "MONGODB_URI",
] as const satisfies readonly (keyof OsuAppEnv)[]);
