/**
 * @file tests/check/cli.test.ts
 * @desc runCheck against fixture apps under tests/check/fixtures: exits 0 for an app without an
 *       API and for a full app, exits 1 and names the missing file for a partial app, and exits 1
 *       when src/app is missing entirely.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCheck } from "../../src/check/cli.js";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe("runCheck", () => {
  it("exits 0 for an app without an API", () => {
    expect(runCheck(fixture("no-api"), () => {})).toBe(0);
  });
  it("exits 0 for a full app", () => {
    expect(runCheck(fixture("full"), () => {})).toBe(0);
  });
  it("exits 1 and names the missing file", () => {
    const lines: string[] = [];
    expect(runCheck(fixture("missing-openapi"), (l) => lines.push(l))).toBe(1);
    expect(lines.join("\n")).toContain("api/v1/openapi.json/route.ts");
  });
  it("exits 1 without src/app", () => {
    expect(runCheck(fixture("bare"), () => {})).toBe(1);
  });
});
