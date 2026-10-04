/**
 * @file tests/check/standards.test.ts
 * @desc checkStandards: a full app passes, a missing crawl file is named, the API standard is
 *       skipped without api/v1 and required once it exists, docs/api accepts a dynamic docs
 *       route, and robots/sitemap accept either the plain file or a route handler.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { describe, expect, it } from "vitest";
import { checkStandards } from "../../src/check/standards.js";

const CRAWL = [
  "robots.ts",
  "sitemap.ts",
  "llms.txt/route.ts",
  "llms-full.txt/route.ts",
  ".well-known/security.txt/route.ts",
];
const API = [
  "api/v1/me/route.ts",
  "api/v1/openapi.json/route.ts",
  "api/me/api-key/route.ts",
  "docs/api/page.tsx",
];
const byId = (files: string[]) => Object.fromEntries(checkStandards(files).map((r) => [r.id, r]));

describe("checkStandards", () => {
  it("passes a full app", () => {
    expect(checkStandards([...CRAWL, ...API, "page.tsx"]).every((r) => r.ok)).toBe(true);
  });

  it("names each missing crawl file", () => {
    expect(byId(CRAWL.slice(1)).crawl?.missing).toEqual(["robots.ts"]);
  });

  it("skips the API standard without api/v1", () => {
    expect(byId(CRAWL).api).toBeUndefined();
  });

  it("requires openapi.json once api/v1 exists", () => {
    const files = [...CRAWL, ...API.filter((f) => !f.includes("openapi"))];
    expect(byId(files).api?.missing).toEqual(["api/v1/openapi.json/route.ts"]);
  });

  it("accepts docs/api from a dynamic docs route", () => {
    const files = [
      ...CRAWL,
      ...API.filter((f) => f !== "docs/api/page.tsx"),
      "docs/[slug]/page.tsx",
    ];
    expect(byId(files).api?.ok).toBe(true);
  });

  it("accepts robots and sitemap as .js or route handlers", () => {
    const files = ["robots.txt/route.ts", "sitemap.xml/route.ts", ...CRAWL.slice(2)];
    expect(byId(files).crawl?.ok).toBe(true);
  });
});
