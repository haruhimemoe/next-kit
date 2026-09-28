/**
 * @file vitest.config.ts
 * @desc Vitest config: every test under tests/ (node by default; component tests pick jsdom with
 *       a docblock), one in-memory MongoDB for the files that need a database, and v8 coverage
 *       with a 95% floor on src/.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    globalSetup: ["tests/setup/mongo-global.ts"],
    // One in-memory server: files that use it clear their own collections.
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
