/**
 * @file src/env/errors.ts
 * @desc EnvError, thrown for a missing or invalid environment variable. Its message names the
 *       variable and never prints its value.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** A missing or invalid environment variable, named but never printed. */
export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

/**
 * @function invalidEnv
 * @param keys {readonly string[]} the variables that are missing or invalid
 * @returns {EnvError} "Missing or invalid environment variables: A, B. See .env.example."
 */
export const invalidEnv = (keys: readonly string[]): EnvError =>
  new EnvError(`Missing or invalid environment variables: ${keys.join(", ")}. See .env.example.`);
