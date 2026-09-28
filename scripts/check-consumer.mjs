/**
 * @file scripts/check-consumer.mjs
 * @desc Installs the packed package with a given zod version, and the other peers at the versions
 *       the apps pin (this repo's devDependencies), into a throwaway project, then typechecks a
 *       strict consumer that imports every entry point and runs it (testing only typechecks: it
 *       needs Vitest's runner). Proves the zod peer range's floor. Usage: node
 *       scripts/check-consumer.mjs <zod version> (after `bun run build`). Needs the npm registry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const zod = process.argv[2];
if (!zod) throw new Error("usage: node scripts/check-consumer.mjs <zod version>");
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const PEERS = [
  ...Object.keys(pkg.peerDependencies).filter((name) => name !== "zod"),
  "react-dom",
  "@types/react",
  "@types/node",
].map((name) => `${name}@${pkg.devDependencies[name]}`);
const dir = mkdtempSync(path.join(tmpdir(), "next-kit-consumer-"));
const run = (command, args, cwd = dir) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // mongodb-memory-server would download a MongoDB binary; the consumer never starts one.
    env: { ...process.env, MONGOMS_DISABLE_POSTINSTALL: "1" },
  });

const CONSUMER = `import { z } from "zod";
import { createOsuAuth, getOsuUser, type OsuAuth, type OsuSessionUser } from "@haruhimemoe/next-kit/auth";
import { createAccountStore, createAuthComponents, createSignedInMarker, osuAvatarSrc, osuSignIn, safeNextPath, type Account, type BoundAccountMenuProps } from "@haruhimemoe/next-kit/auth-react";
import { createServerEnv, EnvError, OSU_APP_PLACEHOLDERS, OSU_APP_SECRET_KEYS, osuAppEnvSchema } from "@haruhimemoe/next-kit/env";
import { createMongo, defineCollections, ensureIndexes, type IndexSpec } from "@haruhimemoe/next-kit/mongo";
import { createRateLimiter, parseJsonBody, parseIdList, refuseCrossSite, type RateLimitRule } from "@haruhimemoe/next-kit/server";
import type { setupTestDb, TestDbOptions } from "@haruhimemoe/next-kit/testing";

const env = createServerEnv({ schema: osuAppEnvSchema.extend({ EXTRA: z.string().optional() }), placeholders: OSU_APP_PLACEHOLDERS, secretKeys: OSU_APP_SECRET_KEYS });
const parsed = env.parse({ SKIP_ENV_VALIDATION: "true" });
const clientId: string = parsed.OSU_CLIENT_ID;
// @ts-expect-error an unknown variable must not typecheck (it would if types were any)
void parsed.NOPE;
const names = defineCollections({ pools: "pools" });
const pools: "pools" = names.pools;
const index: IndexSpec = { collection: pools, key: { a: 1 } };
const rule: RateLimitRule = { scope: "s", limit: 1, windowSeconds: 60 };
const mongo = createMongo({ dbName: "x", globalKey: "__x", uri: () => "mongodb://127.0.0.1:1" });
const limiter = createRateLimiter({ db: mongo.connectedDb });
type User = OsuAuth["$Infer"]["Session"]["user"];
const osuId: User["osuId"] = 2;
const user: OsuSessionUser | null = null;
const account: Account = { status: "loading" };
const store = createAccountStore({ getSession: async () => null, readCookie: () => "", hasMarker: () => false, clearMarker: () => {} });
const options: TestDbOptions | null = null;
const body = await parseJsonBody(new Request("http://x/", { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":1}' }), z.strictObject({ a: z.number() }));
if (!body.ok || body.data.a !== 1) throw new Error("body");
if (parseIdList("1,2", { max: 2 })?.length !== 2) throw new Error("ids");
if (refuseCrossSite(new Request("http://x/"), { siteUrl: "http://x", siteTitle: "x" }) !== null) throw new Error("cross-site");
if (safeNextPath("//x", { fallback: "/me" }) !== "/me") throw new Error("next");
if (!createSignedInMarker("m").has("m=1")) throw new Error("marker");
if (osuSignIn("/me").provider !== "osu") throw new Error("sign-in");
if (osuAvatarSrc("/x") !== "https://osu.ppy.sh/x") throw new Error("avatar");
const authUi = createAuthComponents({ signIn: { social: async () => ({ data: null, error: null }) }, signOut: async () => ({}) }, { useAccount: () => account, markSignedOut: () => {} });
const menuProps: BoundAccountMenuProps = { items: [{ href: "/me", label: "Me" }] };
if (!(new EnvError("x") instanceof Error)) throw new Error("env error");
void [authUi, menuProps, clientId, index, rule, limiter, osuId, user, account, store, options, ensureIndexes, createOsuAuth, getOsuUser];
type _ = typeof setupTestDb;
console.log("consumer: ok");
`;

try {
  const tarball = run("npm", ["pack", "--silent", "--pack-destination", dir], root).trim();
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", private: true }));
  run("npm", [
    "install",
    "--silent",
    "--no-audit",
    "--no-fund",
    path.join(dir, tarball),
    `zod@${zod}`,
    ...PEERS,
  ]);
  writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        // The peers' own .d.ts are not ours to check; the @ts-expect-error above proves this
        // package's types aren't any.
        skipLibCheck: true,
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "ES2023",
        lib: ["ES2023", "DOM", "DOM.Iterable"],
        jsx: "react-jsx",
        types: ["node"],
      },
      files: ["consumer.ts"],
    }),
  );
  writeFileSync(path.join(dir, "consumer.ts"), CONSUMER);
  run(path.join(root, "node_modules", ".bin", "tsc"), ["-p", dir]);
  run(process.execPath, ["--experimental-strip-types", "--no-warnings", "consumer.ts"]);
  console.log(`zod ${zod}: ok`);
} catch (error) {
  console.error(`zod ${zod}: FAILED\n${error.stdout ?? ""}${error.stderr ?? error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
