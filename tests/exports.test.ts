/**
 * @file tests/exports.test.ts
 * @desc The public surface of every entry point: exactly these runtime exports, so an accidental
 *       export or removal shows up in review as a semver question; package.json maps each entry
 *       point and nothing else; the browser entry point never loads server code (node:crypto,
 *       better-auth, mongodb, mongoose; only react, next/navigation and @haruhimemoe/ui), seo loads
 *       nothing at runtime, and no source file passes 200 lines.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 4, 2026
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as apiKeys from "../src/api-keys/index.js";
import * as auth from "../src/auth/index.js";
import * as authReact from "../src/auth-react/index.js";
import * as docsFiles from "../src/docs/files/index.js";
import * as docs from "../src/docs/index.js";
import * as env from "../src/env/index.js";
import * as mongo from "../src/mongo/index.js";
import * as seo from "../src/seo/index.js";
import * as server from "../src/server/index.js";
import * as testing from "../src/testing/index.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const ENTRIES = [
  "server",
  "env",
  "mongo",
  "auth",
  "auth-react",
  "testing",
  "seo",
  "api-keys",
  "docs",
  "docs/files",
];

/** Every bare or node: module a src/ file loads at runtime, following relative imports. */
const loads = (file: URL, seen = new Set<string>(), found = new Set<string>()) => {
  if (seen.has(file.href)) return found;
  seen.add(file.href);
  const source = readFileSync(file, "utf8");
  for (const [, target = ""] of source.matchAll(
    /^(?:import|export) (?!type )[^;]*?from "([^"]+)";/gms,
  )) {
    if (!target.startsWith(".")) found.add(target);
    else {
      const tsx = new URL(target.replace(/\.js$/, ".tsx"), file);
      loads(existsSync(tsx) ? tsx : new URL(target.replace(/\.js$/, ".ts"), file), seen, found);
    }
  }
  return found;
};

it("maps every entry point, and only those", () => {
  expect(Object.keys(pkg.exports).sort()).toEqual(
    [...ENTRIES.map((entry) => `./${entry}`), "./package.json"].sort(),
  );
  for (const entry of ENTRIES) {
    expect(pkg.exports[`./${entry}`]).toEqual({
      types: `./dist/${entry}/index.d.ts`,
      default: `./dist/${entry}/index.js`,
    });
  }
});

it("keeps the browser entry point free of server code", () => {
  expect([...loads(new URL("../src/auth-react/index.ts", import.meta.url))].sort()).toEqual([
    "@haruhimemoe/ui",
    "next/navigation.js",
    "react",
  ]);
});

it("keeps the seo entry point free of runtime imports (Next's types only)", () => {
  expect([...loads(new URL("../src/seo/index.ts", import.meta.url))]).toEqual([]);
});

it("keeps every source file under 200 lines", () => {
  for (const dir of [...ENTRIES, "check"]) {
    // withFileTypes: an entry point directory can hold a nested entry point's own directory
    // (docs/files under docs), which readdirSync also lists and which is checked on its own.
    for (const file of readdirSync(new URL(`../src/${dir}`, import.meta.url), {
      withFileTypes: true,
    })) {
      if (!file.isFile()) continue;
      const text = readFileSync(new URL(`../src/${dir}/${file.name}`, import.meta.url), "utf8");
      expect(text.split("\n").length, `${dir}/${file.name}`).toBeLessThanOrEqual(200);
    }
  }
});

it("exports the documented server API", () => {
  expect(Object.keys(server).sort()).toMatchInlineSnapshot(`
    [
      "COUNTER_GRACE_MS",
      "DEFAULT_SIGN_IN_PATH",
      "ERROR_CODES",
      "MAX_BODY_BYTES",
      "MAX_ID",
      "MAX_IP_LENGTH",
      "MAX_NEXT_LENGTH",
      "RATE_LIMITS_COLLECTION",
      "SECURITY_TXT_LIFETIME_DAYS",
      "SECURITY_TXT_PATH",
      "bearerToken",
      "buildSecurityTxt",
      "clientIp",
      "counterTtlIndex",
      "createBudget",
      "createRateLimiter",
      "crossSiteMessage",
      "errorCodeFor",
      "jsonError",
      "noStore",
      "parseIdList",
      "parseJsonBody",
      "rateLimitHeaders",
      "rateLimitId",
      "rateLimitSubject",
      "refuseCrossSite",
      "refuseWithoutBearer",
      "retryText",
      "safeNextPath",
      "sameSecret",
      "signInHref",
      "tooManyRequests",
      "unlimited",
      "userSubject",
      "windowFor",
      "withHeaders",
    ]
  `);
});

it("exports the documented env API", () => {
  expect(Object.keys(env).sort()).toMatchInlineSnapshot(`
    [
      "BUILD_PHASE",
      "EnvError",
      "OSU_APP_PLACEHOLDERS",
      "OSU_APP_SECRET_KEYS",
      "createServerEnv",
      "invalidEnv",
      "isEnvValidationSkipped",
      "isProductionServer",
      "optionalSecret",
      "osuAppEnvSchema",
      "readFlag",
      "readIdSet",
      "readOptional",
      "readOrigin",
    ]
  `);
});

it("exports the documented mongo API", () => {
  expect(Object.keys(mongo).sort()).toMatchInlineSnapshot(`
    [
      "DEFAULT_MAX_POOL_SIZE",
      "DEFAULT_SERVER_SELECTION_TIMEOUT_MS",
      "DUPLICATE_KEY",
      "createMongo",
      "defineCollections",
      "ensureIndexes",
      "indexName",
      "isDuplicateKeyError",
      "ttlIndex",
    ]
  `);
});

it("exports the documented auth API", () => {
  expect(Object.keys(auth).sort()).toMatchInlineSnapshot(`
    [
      "AUTH_INDEXES",
      "AUTH_INDEX_SPECS",
      "OSU_PROVIDER_ID",
      "OSU_USER_FIELDS",
      "createOsuAuth",
      "getOsuUser",
      "osuProfileToUser",
      "osuProvider",
      "toSessionUser",
      "withoutTokens",
    ]
  `);
});

it("exports the documented auth-react API", () => {
  expect(Object.keys(authReact).sort()).toMatchInlineSnapshot(`
    [
      "AccountMenu",
      "DEFAULT_SIGN_IN_PATH",
      "DeleteAccountForm",
      "LOADING",
      "OSU_AVATAR_HOSTS",
      "OSU_PROVIDER_ID",
      "RestoreSignedIn",
      "SignInWithOsu",
      "SignOutButton",
      "createAccount",
      "createAccountStore",
      "createAuthComponents",
      "createSignedInMarker",
      "markerMaxAge",
      "osuAvatarSrc",
      "osuSignIn",
      "safeNextPath",
      "sessionFetcher",
      "signInErrorMessage",
      "signInHref",
      "useAccount",
    ]
  `);
});

it("exports the documented testing API", () => {
  expect(Object.keys(testing).sort()).toMatchInlineSnapshot(`
    [
      "BETTER_AUTH_COLLECTIONS",
      "TEST_OSU_APP_ENV",
      "setupMsw",
      "setupTestDb",
      "startMemoryMongo",
      "stubEnv",
      "stubOsuAppEnv",
    ]
  `);
});

it("exports the documented seo API", () => {
  expect(Object.keys(seo).sort()).toMatchInlineSnapshot(`
    [
      "AI_BOTS",
      "DESCRIPTION_MAX",
      "HARUHIME_ORG",
      "SEARCH_TERM",
      "SITEMAP_MAX_URLS",
      "TITLE_MAX",
      "TITLE_SEPARATOR",
      "clampDescription",
      "homeMetadata",
      "ld",
      "llmsFull",
      "llmsTxt",
      "notFoundMetadata",
      "pageMetadata",
      "pageTitle",
      "robots",
      "serializeLd",
      "siteMetadata",
      "sitemapEntries",
      "textResponse",
    ]
  `);
});

it("exports the documented api-keys API", () => {
  expect(Object.keys(apiKeys).sort()).toMatchInlineSnapshot(`
    [
      "API_KEYS_COLLECTION",
      "API_KEY_BYTES",
      "API_KEY_DISPLAY_LENGTH",
      "API_KEY_PREFIX_PATTERN",
      "API_LIMITS",
      "API_SERVER_ERROR",
      "LAST_USED_INTERVAL_MS",
      "apiKeyDisplay",
      "apiKeyIndexSpecs",
      "apiKeyToken",
      "assertApiKeyPrefix",
      "createApiKeyGuard",
      "createApiKeyStore",
      "generateApiKey",
      "hashApiKey",
      "isApiKeyFormat",
    ]
  `);
});

it("exports the documented docs API", () => {
  expect(Object.keys(docs).sort()).toMatchInlineSnapshot(`
    [
      "CONTENT_SECTIONS",
      "SECTION_LABELS",
      "contentLlmsFull",
      "contentLlmsTxt",
      "contentParams",
      "contentPath",
      "contentRewrites",
      "contentSitemap",
      "defineContent",
      "findEntry",
      "markdownPath",
      "mdxToMarkdown",
    ]
  `);
});

it("exports the documented docs/files API", () => {
  expect(Object.keys(docsFiles).sort()).toMatchInlineSnapshot(`
    [
      "contentFileDrift",
      "readContentMarkdown",
    ]
  `);
});
