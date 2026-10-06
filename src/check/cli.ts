#!/usr/bin/env node
/**
 * @file src/check/cli.ts
 * @desc `next-kit check [dir]`: lists src/app and content (when it exists) under dir (default:
 *       the working directory), runs checkStandards and prints one line per standard. Exits 1
 *       when one fails or src/app is missing.
 *
 *       0.12: `next-kit migrate-identity --from bb,packs,pools --to identity [--uri <uri>]
 *       [--execute] [--drop-old]`, a thin argv/MongoClient wrapper around migrateIdentity.
 *       Dry run by default (the plan prints and nothing is written); `--execute` writes.
 *       `--drop-old` additionally drops each app's old session/account/verification
 *       collections, meant for a separate run after every app has cut over to
 *       createSessionReader. The CLI never rewrites userId references in an app's own
 *       collections (that needs each app's own `{ collection, field }` list, which has no
 *       sane flag syntax); call migrateIdentity directly from an app's own script for that.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Tue Oct 6, 2026
 */

import { existsSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { argv, cwd, env, exit } from "node:process";
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";
import { migrateIdentity } from "./migrate-identity.js";
import { checkStandards } from "./standards.js";

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );

const relativeFiles = (dir: string): string[] =>
  walk(dir).map((file) => relative(dir, file).split(sep).join("/"));

/**
 * @function runCheck
 * @param root {string} the app's root (holds src/app and, optionally, content/)
 * @param log {(line: string) => void} where lines go (default console.log)
 * @returns {number} 0 when every standard passes, otherwise 1
 */
export const runCheck = (root: string, log: (line: string) => void = console.log): number => {
  const app = join(root, "src", "app");
  if (!existsSync(app)) {
    log(`next-kit check: no src/app in ${root}`);
    return 1;
  }
  const contentDir = join(root, "content");
  const contentFiles = existsSync(contentDir) ? relativeFiles(contentDir) : [];
  const results = checkStandards(relativeFiles(app), contentFiles);
  for (const result of results) {
    log(`${result.ok ? "pass" : "FAIL"}  ${result.label}`);
    for (const missing of result.missing) log(`      missing ${missing}`);
  }
  return results.every((result) => result.ok) ? 0 : 1;
};

/** A --flag or --flag=value argv entry's value; a bare --flag reads true. */
const flagValue = (args: readonly string[], name: string): string | boolean | undefined => {
  const eq = args.find((arg) => arg.startsWith(`--${name}=`));
  if (eq) return eq.slice(`--${name}=`.length);
  return args.includes(`--${name}`) ? true : undefined;
};

/**
 * @function runMigrateIdentity
 * @param args {readonly string[]} argv after "migrate-identity"
 * @param log {(line: string) => void} where lines go (default console.log)
 * @returns {Promise<number>} 0 once the plan (or the migration) runs, 1 for a bad invocation
 */
export const runMigrateIdentity = async (
  args: readonly string[],
  log: (line: string) => void = console.log,
): Promise<number> => {
  const from = flagValue(args, "from");
  const to = flagValue(args, "to");
  if (typeof from !== "string" || typeof to !== "string") {
    log("usage: next-kit migrate-identity --from <app,app,...> --to <identityDb> [--uri <uri>] [--execute] [--drop-old]");
    return 1;
  }
  const uri = flagValue(args, "uri");
  const mongoUri = typeof uri === "string" ? uri : env.MONGODB_URI;
  if (!mongoUri) {
    log("next-kit migrate-identity: no --uri and no MONGODB_URI");
    return 1;
  }
  const dryRun = flagValue(args, "execute") !== true;
  const dropOld = flagValue(args, "drop-old") === true;
  const appIds = from.split(",").map((id) => id.trim()).filter(Boolean);
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const apps = appIds.map((id) => ({ id, db: client.db(id) }));
    const report = await migrateIdentity(apps, client.db(to), { dryRun, dropOld });
    log(`next-kit migrate-identity: ${dryRun ? "dry run" : "executed"} (--to ${to})`);
    log(`  users seen: ${report.usersSeen}, winners: ${report.usersWritten}`);
    log(`  accounts copied: ${report.accountsCopied}, sessions dropped: ${report.sessionsDropped}`);
    log(`  api keys copied: ${report.apiKeysCopied}`);
    if (report.droppedCollections.length > 0) {
      log(`  dropped: ${report.droppedCollections.map((d) => `${d.app}.${d.collection}`).join(", ")}`);
    }
    if (dryRun) log("  (dry run: nothing was written; pass --execute to apply)");
    return 0;
  } finally {
    await client.close();
  }
};

/* v8 ignore start */
/** True when this file is the one Node was asked to run, even through a symlinked bin: a
 * symlinked `next-kit` resolves argv[1] to the link, while import.meta.url is the realpath. */
const isMainEntry = (): boolean => {
  const entry = argv[1];
  if (!entry || !existsSync(entry)) return false;
  return pathToFileURL(realpathSync(entry)).href === import.meta.url;
};

if (isMainEntry()) {
  const [command, ...rest] = argv.slice(2);
  if (command === "migrate-identity") {
    exit(await runMigrateIdentity(rest));
  } else if (command === "check") {
    exit(runCheck(rest[0] ?? cwd()));
  } else {
    console.log("usage: next-kit check [dir]");
    console.log("       next-kit migrate-identity --from <app,app,...> --to <identityDb> [--uri <uri>] [--execute] [--drop-old]");
    exit(2);
  }
}
/* v8 ignore stop */
