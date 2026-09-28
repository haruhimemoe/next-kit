/**
 * @file src/env/server-env.ts
 * @desc Server environment, validated with zod on first use (not at import), so `next build` and
 *       public pages build without auth variables. SKIP_ENV_VALIDATION=true (CI) swaps missing
 *       values for placeholders nothing connects with; a production server (VERCEL_ENV=production
 *       when VERCEL_ENV is set, else NODE_ENV=production; never during `next build`) refuses that
 *       when a secret would be one of these public placeholders. Moved from packs and pools
 *       (src/env.ts), whose mechanism was the same code around the same five variables.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { z } from "zod";
import { EnvError, invalidEnv } from "./errors.js";

/** process.env, or a stand-in in tests. */
export type EnvSource = Record<string, string | undefined>;

/** Set in process.env by `next build` for the whole build, prerendering included. */
export const BUILD_PHASE = "phase-production-build";

/**
 * @function isProductionServer
 * @param source {EnvSource} usually process.env
 * @returns {boolean} false during `next build`; VERCEL_ENV=production when VERCEL_ENV is set;
 *          otherwise NODE_ENV=production
 */
export const isProductionServer = (source: EnvSource): boolean => {
  if (source.NEXT_PHASE === BUILD_PHASE) return false;
  if (source.VERCEL_ENV) return source.VERCEL_ENV === "production";
  return source.NODE_ENV === "production";
};

/**
 * @function isEnvValidationSkipped
 * @param source {EnvSource} usually process.env (the default)
 * @returns {boolean} true in CI builds (SKIP_ENV_VALIDATION=true), where nothing may query the
 *          database: public pages then prerender empty
 */
export const isEnvValidationSkipped = (source: EnvSource = process.env): boolean =>
  source.SKIP_ENV_VALIDATION === "true";

/** A zod object of string variables. */
export type EnvSchema = z.ZodObject<Record<string, z.ZodType<string | undefined>>>;

/** createServerEnv's options. */
export type ServerEnvOptions<S extends EnvSchema> = {
  /** The variables every server request needs. */
  schema: S;
  /** Used only under SKIP_ENV_VALIDATION=true. Nothing may connect with these. */
  placeholders: z.output<S>;
  /** The variables whose placeholder, being in public source, would be a known secret. */
  secretKeys: readonly (keyof z.output<S> & string)[];
};

/** What createServerEnv returns. */
export type ServerEnv<T> = {
  /** Every variable name in the schema. */
  keys: readonly (keyof T & string)[];
  /** Validates the variables, trimmed; throws an EnvError naming (never printing) each bad one. */
  parse: (source: EnvSource) => T;
  /** Validates only these variables (a page that needs just the database). */
  pick: <K extends keyof T & string>(source: EnvSource, keys: readonly K[]) => Pick<T, K>;
  /** process.env, parsed once and memoized. */
  get: () => T;
  /** Forgets the memoized value (tests). */
  reset: () => void;
  /** Throws when SKIP_ENV_VALIDATION would put a placeholder secret on a production server. */
  assertNoPlaceholderSecrets: (source: EnvSource, keys?: readonly (keyof T & string)[]) => void;
};

/**
 * @function createServerEnv
 * @param options {ServerEnvOptions<S>} the schema, its placeholders and which keys are secrets
 * @returns {ServerEnv<z.output<S>>} parse, pick, get (memoized), reset and the placeholder guard
 */
export const createServerEnv = <S extends EnvSchema>({
  schema,
  placeholders,
  secretKeys,
}: ServerEnvOptions<S>): ServerEnv<z.output<S>> => {
  type T = z.output<S>;
  type Key = keyof T & string;
  const keys = Object.freeze(Object.keys(schema.shape)) as readonly Key[];
  const values = placeholders as Record<string, string | undefined>;

  const assertNoPlaceholderSecrets = (
    source: EnvSource,
    checked: readonly Key[] = secretKeys,
  ): void => {
    if (!isEnvValidationSkipped(source) || !isProductionServer(source)) return;
    const found = checked.filter((key) => {
      const value = source[key]?.trim();
      return !value || value === values[key];
    });
    if (found.length === 0) return;
    throw new EnvError(
      `SKIP_ENV_VALIDATION is set on a production server, so ${found.join(", ")} would fall back to public placeholders. Set the real values and unset SKIP_ENV_VALIDATION.`,
    );
  };

  const pick = <K extends Key>(source: EnvSource, wanted: readonly K[]): Pick<T, K> => {
    const present: Record<string, string> = {};
    for (const key of wanted) {
      const value = source[key]?.trim();
      if (value) present[key] = value;
    }
    if (isEnvValidationSkipped(source)) {
      assertNoPlaceholderSecrets(
        source,
        secretKeys.filter((key) => (wanted as readonly Key[]).includes(key)),
      );
      const fallback = Object.fromEntries(wanted.map((key) => [key, values[key]]));
      return { ...fallback, ...present } as Pick<T, K>;
    }
    const mask = Object.fromEntries(wanted.map((key) => [key, true] as const));
    const picked = (schema as EnvSchema).pick(mask as Record<string, true>);
    const parsed = (picked as unknown as z.ZodType<Pick<T, K>>).safeParse(present);
    if (parsed.success) return parsed.data;
    throw invalidEnv([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]);
  };

  let cached: T | null = null;
  return {
    keys,
    parse: (source) => pick(source, keys) as T,
    pick,
    get: () => {
      cached ??= pick(process.env, keys) as T;
      return cached;
    },
    reset: () => {
      cached = null;
    },
    assertNoPlaceholderSecrets,
  };
};
