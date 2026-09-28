/**
 * @file tests/env/server-env.test.ts
 * @desc createServerEnv with the osu! app's variables: packs' cases (tests/unit/env.test.ts:
 *       parsing, the database-only pick, the production placeholder guard on and off Vercel),
 *       which pools' copy shares.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServerEnv,
  EnvError,
  type EnvSource,
  isEnvValidationSkipped,
  OSU_APP_PLACEHOLDERS,
  OSU_APP_SECRET_KEYS,
  osuAppEnvSchema,
} from "../../src/env/index.js";
import { TEST_OSU_APP_ENV } from "../../src/testing/env.js";

const env = createServerEnv({
  schema: osuAppEnvSchema,
  placeholders: OSU_APP_PLACEHOLDERS,
  secretKeys: OSU_APP_SECRET_KEYS,
});
const parseServerEnv = env.parse;
const parseDatabaseEnv = (source: EnvSource) => env.pick(source, ["MONGODB_URI"]);
const { assertNoPlaceholderSecrets } = env;

const errorFrom = (source: EnvSource): Error => {
  try {
    parseServerEnv(source);
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected parse to throw");
};

afterEach(() => {
  vi.unstubAllEnvs();
  env.reset();
});

describe("parse", () => {
  it("returns exactly the server variables", () => {
    expect(parseServerEnv({ ...TEST_OSU_APP_ENV, UNRELATED: "x" })).toEqual(TEST_OSU_APP_ENV);
  });

  it("names every missing variable, in schema order", () => {
    const error = errorFrom({});
    expect(error).toBeInstanceOf(EnvError);
    expect(error.name).toBe("EnvError");
    expect(error.message).toBe(
      `Missing or invalid environment variables: ${env.keys.join(", ")}. See .env.example.`,
    );
  });

  it("never puts a value in the error message", () => {
    const secret = "short-secret-value";
    const error = errorFrom({ ...TEST_OSU_APP_ENV, BETTER_AUTH_SECRET: secret });
    expect(error.message).toContain("BETTER_AUTH_SECRET");
    expect(error.message).not.toContain(secret);
  });

  it("treats blank values as missing and trims the rest", () => {
    expect(errorFrom({ ...TEST_OSU_APP_ENV, OSU_CLIENT_SECRET: "   " }).message).toContain(
      "OSU_CLIENT_SECRET",
    );
    expect(parseServerEnv({ ...TEST_OSU_APP_ENV, OSU_CLIENT_ID: " 7 " }).OSU_CLIENT_ID).toBe("7");
  });

  it.each([
    ["OSU_CLIENT_ID", "abc"],
    ["MONGODB_URI", "postgres://x"],
    ["BETTER_AUTH_URL", "not a url"],
  ])("rejects a bad %s", (key, value) => {
    expect(errorFrom({ ...TEST_OSU_APP_ENV, [key]: value }).message).toContain(key);
  });

  it("fills placeholders under SKIP_ENV_VALIDATION but keeps real values", () => {
    const parsed = parseServerEnv({ SKIP_ENV_VALIDATION: "true", OSU_CLIENT_ID: "42" });
    expect(parsed.OSU_CLIENT_ID).toBe("42");
    expect(parsed.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(parsed.MONGODB_URI).toMatch(/^mongodb:\/\//);
    expect(parsed.BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
});

describe("get and reset", () => {
  it("reads process.env once, memoized until reset", () => {
    for (const [key, value] of Object.entries(TEST_OSU_APP_ENV)) vi.stubEnv(key, value);
    const first = env.get();
    vi.stubEnv("OSU_CLIENT_ID", "99");
    expect(env.get()).toBe(first);
    env.reset();
    expect(env.get().OSU_CLIENT_ID).toBe("99");
  });

  it("knows when validation is skipped", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    expect(isEnvValidationSkipped()).toBe(true);
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    expect(isEnvValidationSkipped()).toBe(false);
    expect(isEnvValidationSkipped({ SKIP_ENV_VALIDATION: "true" })).toBe(true);
  });
});

describe("pick (the database URI alone)", () => {
  it("needs only MONGODB_URI, so builds without auth config can still read public pages", () => {
    expect(parseDatabaseEnv({ MONGODB_URI: " mongodb://db.example:27017 " })).toEqual({
      MONGODB_URI: "mongodb://db.example:27017",
    });
  });

  it("names MONGODB_URI when it's missing or wrong, never printing it", () => {
    for (const value of [undefined, "  ", "postgres://secret@x"]) {
      expect(() => parseDatabaseEnv({ ...TEST_OSU_APP_ENV, MONGODB_URI: value })).toThrow(
        new EnvError("Missing or invalid environment variables: MONGODB_URI. See .env.example."),
      );
    }
  });

  it("falls back to the placeholder under SKIP_ENV_VALIDATION", () => {
    expect(parseDatabaseEnv({ SKIP_ENV_VALIDATION: "true" }).MONGODB_URI).toMatch(/^mongodb:\/\//);
  });
});

describe("SKIP_ENV_VALIDATION in production", () => {
  const SKIP_IN_PROD = { SKIP_ENV_VALIDATION: "true", NODE_ENV: "production" };

  it("throws at runtime, naming every secret that would be a placeholder", () => {
    for (const parse of [parseServerEnv, assertNoPlaceholderSecrets]) {
      expect(() => parse(SKIP_IN_PROD)).toThrow(
        new EnvError(
          "SKIP_ENV_VALIDATION is set on a production server, so BETTER_AUTH_SECRET, OSU_CLIENT_SECRET, MONGODB_URI would fall back to public placeholders. Set the real values and unset SKIP_ENV_VALIDATION.",
        ),
      );
    }
  });

  it.each(OSU_APP_SECRET_KEYS)("throws when only %s is missing", (key) => {
    const source = { ...TEST_OSU_APP_ENV, ...SKIP_IN_PROD, [key]: undefined };
    expect(() => parseServerEnv(source)).toThrow(key);
  });

  it("checks only the keys asked for", () => {
    expect(() => assertNoPlaceholderSecrets(SKIP_IN_PROD, ["OSU_CLIENT_SECRET"])).toThrow(
      "so OSU_CLIENT_SECRET would",
    );
  });

  it("throws for the database URI on its own too", () => {
    expect(() => parseDatabaseEnv(SKIP_IN_PROD)).toThrow("MONGODB_URI");
    expect(parseDatabaseEnv({ ...SKIP_IN_PROD, MONGODB_URI: "mongodb://db:27017" })).toEqual({
      MONGODB_URI: "mongodb://db:27017",
    });
  });

  it("throws when a secret is set to the placeholder itself", () => {
    const placeholder = parseServerEnv({ SKIP_ENV_VALIDATION: "true" }).BETTER_AUTH_SECRET;
    const source = { ...TEST_OSU_APP_ENV, ...SKIP_IN_PROD, BETTER_AUTH_SECRET: placeholder };
    expect(() => parseServerEnv(source)).toThrow("BETTER_AUTH_SECRET");
  });

  it("allows it with every real secret set", () => {
    // TEST_OSU_APP_ENV's MONGODB_URI equals the placeholder, so use another one.
    const real = { ...TEST_OSU_APP_ENV, MONGODB_URI: "mongodb://db.example:27017" };
    expect(parseServerEnv({ ...real, ...SKIP_IN_PROD })).toEqual(real);
  });

  it("allows it during next build and outside production", () => {
    const build = { ...SKIP_IN_PROD, NEXT_PHASE: "phase-production-build" };
    expect(() => parseServerEnv(build)).not.toThrow();
    expect(() => parseDatabaseEnv(build)).not.toThrow();
    expect(() => parseServerEnv({ SKIP_ENV_VALIDATION: "true", NODE_ENV: "test" })).not.toThrow();
  });
});

describe("SKIP_ENV_VALIDATION on Vercel (VERCEL_ENV set)", () => {
  const SKIP_IN_PROD = { SKIP_ENV_VALIDATION: "true", NODE_ENV: "production" };

  it.each(["preview", "development"])("allows placeholders on VERCEL_ENV=%s", (vercelEnv) => {
    const source = { ...SKIP_IN_PROD, VERCEL_ENV: vercelEnv };
    expect(() => assertNoPlaceholderSecrets(source)).not.toThrow();
    expect(() => parseServerEnv(source)).not.toThrow();
    expect(() => parseDatabaseEnv(source)).not.toThrow();
  });

  it("throws on VERCEL_ENV=production, naming every placeholder secret", () => {
    const source = { ...SKIP_IN_PROD, VERCEL_ENV: "production" };
    expect(() => assertNoPlaceholderSecrets(source)).toThrow(
      "BETTER_AUTH_SECRET, OSU_CLIENT_SECRET, MONGODB_URI",
    );
    expect(() => parseDatabaseEnv(source)).toThrow("MONGODB_URI");
  });

  it("goes by VERCEL_ENV, not NODE_ENV, whenever VERCEL_ENV is set", () => {
    const source = {
      SKIP_ENV_VALIDATION: "true",
      NODE_ENV: "development",
      VERCEL_ENV: "production",
    };
    expect(() => assertNoPlaceholderSecrets(source)).toThrow(EnvError);
  });

  it("still allows a production build on VERCEL_ENV=production", () => {
    const source = {
      ...SKIP_IN_PROD,
      VERCEL_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    };
    expect(() => assertNoPlaceholderSecrets(source)).not.toThrow();
  });

  it("keeps the NODE_ENV rule when VERCEL_ENV is unset or blank", () => {
    expect(() => assertNoPlaceholderSecrets(SKIP_IN_PROD)).toThrow(EnvError);
    expect(() => assertNoPlaceholderSecrets({ ...SKIP_IN_PROD, VERCEL_ENV: "" })).toThrow(EnvError);
  });
});
