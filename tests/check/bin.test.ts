/**
 * @file tests/check/bin.test.ts
 * @desc Regression for the symlinked-bin case: npm/bun/npx install `next-kit` as a symlink into
 *       node_modules/.bin, which makes argv[1] the link path while import.meta.url is the
 *       realpath. Builds dist once, symlinks dist/check/cli.js the same way, and spawns it so the
 *       entry guard runs for real, not just in-process.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let link: string;
let dir: string;

beforeAll(() => {
  execSync("bun run build", { cwd: root, stdio: "pipe" });
  dir = mkdtempSync(join(tmpdir(), "next-kit-bin-"));
  link = join(dir, "next-kit");
  symlinkSync(join(root, "dist/check/cli.js"), link);
}, 30_000);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the bin, run through a symlink", () => {
  it("exits 1 and names the missing file", () => {
    const result = spawnSync("node", [link, "check", fixture("missing-openapi")], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("api/v1/openapi.json/route.ts");
  });

  it("exits 0 for a full app", () => {
    const result = spawnSync("node", [link, "check", fixture("full")], { encoding: "utf8" });
    expect(result.status).toBe(0);
  });
});
