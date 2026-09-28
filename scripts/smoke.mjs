/**
 * @file scripts/smoke.mjs
 * @desc Imports the built package the way apps will (dist/, peers from node_modules), loads every
 *       entry point, and runs one call from each. Run by `bun run test:dist` after a build.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as auth from "../dist/auth/index.js";
import * as authReact from "../dist/auth-react/index.js";
import * as env from "../dist/env/index.js";
import * as mongo from "../dist/mongo/index.js";
import * as server from "../dist/server/index.js";

const ENTRIES = ["server", "env", "mongo", "auth", "auth-react", "testing"];
for (const entry of ENTRIES) {
  for (const file of ["index.js", "index.d.ts"]) {
    assert.ok(existsSync(new URL(`../dist/${entry}/${file}`, import.meta.url)), `${entry} ${file}`);
  }
}

const refused = server.refuseCrossSite(
  new Request("https://packs.haruhime.moe/api/x", { headers: { origin: "https://evil.example" } }),
  { siteUrl: "https://packs.haruhime.moe", siteTitle: "packs.haruhime.moe" },
);
assert.equal(refused?.status, 403);
assert.deepEqual(server.parseIdList("3,1,2", { max: 64 }), [3, 1, 2]);
assert.equal(server.rateLimitSubject("2001:db8::1"), "2001:db8:0:0::/64");
assert.equal(server.sameSecret("a", "a"), true);

const serverEnv = env.createServerEnv({
  schema: env.osuAppEnvSchema,
  placeholders: env.OSU_APP_PLACEHOLDERS,
  secretKeys: env.OSU_APP_SECRET_KEYS,
});
assert.throws(() => serverEnv.parse({}), env.EnvError);
assert.equal(serverEnv.parse({ SKIP_ENV_VALIDATION: "true" }).OSU_CLIENT_ID, "0");

assert.equal(mongo.indexName({ collection: "c", key: { a: 1, b: -1 } }), "a_1_b_-1");
assert.equal(typeof mongo.createMongo, "function");

assert.equal(auth.osuProfileToUser({ id: 2, username: "peppy" }).email, "2@osu.local");
assert.equal(auth.AUTH_INDEX_SPECS.length, 5);
assert.equal(typeof auth.createOsuAuth, "function");

assert.equal(authReact.createSignedInMarker("x").has("x=1"), true);
assert.equal(authReact.osuSignIn("/me").errorCallbackURL, "/signin?next=%2Fme");
for (const file of ["RestoreSignedIn.js", "use-account.js"]) {
  const text = readFileSync(new URL(`../dist/auth-react/${file}`, import.meta.url), "utf8");
  assert.match(text, /^(\/\*[\s\S]*?\*\/\s*)?"use client";/, `${file} keeps "use client"`);
}
console.log("smoke: ok");
