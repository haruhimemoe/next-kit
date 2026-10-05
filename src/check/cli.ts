#!/usr/bin/env node
/**
 * @file src/check/cli.ts
 * @desc `next-kit check [dir]`: lists src/app and content (when it exists) under dir (default:
 *       the working directory), runs checkStandards and prints one line per standard. Exits 1
 *       when one fails or src/app is missing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sun Oct 4, 2026
 */

import { existsSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { argv, cwd, exit } from "node:process";
import { pathToFileURL } from "node:url";
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

/* v8 ignore start */
/** True when this file is the one Node was asked to run, even through a symlinked bin: a
 * symlinked `next-kit` resolves argv[1] to the link, while import.meta.url is the realpath. */
const isMainEntry = (): boolean => {
  const entry = argv[1];
  if (!entry || !existsSync(entry)) return false;
  return pathToFileURL(realpathSync(entry)).href === import.meta.url;
};

if (isMainEntry()) {
  const [command, dir] = argv.slice(2);
  if (command !== "check") {
    console.log("usage: next-kit check [dir]");
    exit(2);
  }
  exit(runCheck(dir ?? cwd()));
}
/* v8 ignore stop */
