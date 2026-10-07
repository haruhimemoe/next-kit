/**
 * @file tests/check/cli-migrate.test.ts
 * @desc runMigrateIdentity's argv handling: usage without --from/--to, a missing URI, and a dry
 *       run and an executed run against the in-memory MongoDB.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, inject, it, vi } from "vitest";
import { runMigrateIdentity } from "../../src/check/cli.js";

describe("runMigrateIdentity", () => {
  it("prints usage without --from and --to", async () => {
    const lines: string[] = [];
    expect(await runMigrateIdentity(["--from"], (l) => lines.push(l))).toBe(1);
    expect(lines[0]).toMatch(/^usage:/);
  });

  it("refuses without --uri or MONGODB_URI", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const lines: string[] = [];
    expect(await runMigrateIdentity(["--from=a", "--to=id"], (l) => lines.push(l))).toBe(1);
    expect(lines[0]).toContain("no --uri");
    vi.unstubAllEnvs();
  });

  it("dry-runs by default and executes with --execute", async () => {
    const uri = inject("mongoUri");
    const dry: string[] = [];
    const args = ["--from=cli-a, ,cli-b", "--to=cli-identity", `--uri=${uri}`];
    expect(await runMigrateIdentity(args, (l) => dry.push(l))).toBe(0);
    expect(dry.join("\n")).toContain("dry run");
    const run: string[] = [];
    expect(await runMigrateIdentity([...args, "--execute"], (l) => run.push(l))).toBe(0);
    expect(run[0]).toContain("executed");
    expect(run.join("\n")).not.toContain("nothing was written");
  });

  it("reads MONGODB_URI when --uri is absent", async () => {
    vi.stubEnv("MONGODB_URI", inject("mongoUri"));
    expect(await runMigrateIdentity(["--from=cli-c", "--to=cli-identity"], () => {})).toBe(0);
    vi.unstubAllEnvs();
  });
});
