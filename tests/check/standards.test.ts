/**
 * @file tests/check/standards.test.ts
 * @desc checkStandards: a full app passes every standard, a missing crawl file is named, the
 *       API standard is skipped without api/v1 and required once it exists, a section missing
 *       its content file is named with the content/ prefix, docs join in once api/v1 exists or
 *       content/docs has an entry, guides join in only once content/guides has an entry (and are
 *       left out entirely otherwise), and route groups don't break a route match.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
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
const BRAND = ["brand/page.tsx"];
const routeTrio = (section: string) => [
  `${section}/page.tsx`,
  `${section}/[slug]/page.tsx`,
  `${section}/[slug]/md/route.ts`,
];
const LEGAL_ROUTES = routeTrio("legal");
const DOCS_ROUTES = routeTrio("docs");
const GUIDES_ROUTES = routeTrio("guides");
const API_ROUTES = [
  "api/v1/me/route.ts",
  "api/v1/openapi.json/route.ts",
  "api/me/api-key/route.ts",
];
const LEGAL_CONTENT = ["legal/terms.mdx", "legal/privacy.mdx"];
const API_CONTENT = ["docs/api.mdx"];
const GUIDES_CONTENT = ["guides/make-a-pack.mdx"];

const byId = (app: string[], content: string[] = []) =>
  Object.fromEntries(checkStandards(app, content).map((r) => [r.id, r]));

describe("checkStandards", () => {
  it("passes a full packs-shaped tree", () => {
    const app = [
      ...CRAWL,
      ...BRAND,
      ...LEGAL_ROUTES,
      ...DOCS_ROUTES,
      ...GUIDES_ROUTES,
      ...API_ROUTES,
    ];
    const content = [...LEGAL_CONTENT, ...API_CONTENT, ...GUIDES_CONTENT];
    expect(checkStandards(app, content).every((r) => r.ok)).toBe(true);
  });

  it("passes a pools-shaped tree with no content/guides, and leaves guides out", () => {
    const app = [...CRAWL, ...BRAND, ...LEGAL_ROUTES, ...DOCS_ROUTES, ...API_ROUTES];
    const content = [...LEGAL_CONTENT, ...API_CONTENT];
    const results = byId(app, content);
    expect(Object.values(results).every((r) => r.ok)).toBe(true);
    expect(results.guides).toBeUndefined();
  });

  it("never asks an app with no content/guides for guide routes", () => {
    const app = [...CRAWL, ...BRAND, ...LEGAL_ROUTES];
    const content = [...LEGAL_CONTENT];
    expect(byId(app, content).guides).toBeUndefined();
  });

  it("names each missing crawl file with the src/app/ prefix", () => {
    expect(byId(CRAWL.slice(1)).crawl?.missing).toEqual(["src/app/robots.ts"]);
  });

  it("skips the API standard without api/v1", () => {
    expect(byId(CRAWL).api).toBeUndefined();
  });

  it("requires openapi.json once api/v1 exists", () => {
    const app = [...CRAWL, ...BRAND, ...LEGAL_ROUTES, ...DOCS_ROUTES, ...API_ROUTES].filter(
      (f) => !f.includes("openapi"),
    );
    const content = [...LEGAL_CONTENT, ...API_CONTENT];
    expect(byId(app, content).api?.missing).toEqual(["src/app/api/v1/openapi.json/route.ts"]);
  });

  it("fails api on a missing content/docs/api.mdx alone", () => {
    const app = [...CRAWL, ...BRAND, ...LEGAL_ROUTES, ...DOCS_ROUTES, ...API_ROUTES];
    const content = [...LEGAL_CONTENT];
    expect(byId(app, content).api?.missing).toEqual(["content/docs/api.mdx"]);
  });

  it("names a missing legal content file with the content/ prefix", () => {
    const app = [...CRAWL, ...BRAND, ...LEGAL_ROUTES];
    const content = ["legal/terms.mdx"];
    expect(byId(app, content).legal?.missing).toEqual(["content/legal/privacy.mdx"]);
  });

  it("requires docs routes once content/docs has an entry, with no api/v1", () => {
    const app = [...CRAWL, ...BRAND, ...LEGAL_ROUTES];
    const content = [...LEGAL_CONTENT, "docs/getting-started.mdx"];
    expect(byId(app, content).docs?.missing).toEqual([
      "src/app/docs/page.tsx",
      "src/app/docs/[x]/page.tsx",
      "src/app/docs/[x]/md/route.ts",
    ]);
  });

  it("accepts route groups like (public)/legal/page.tsx", () => {
    const app = [
      ...CRAWL,
      ...BRAND,
      "(public)/legal/page.tsx",
      "legal/[slug]/page.tsx",
      "legal/[slug]/md/route.ts",
    ];
    expect(byId(app, LEGAL_CONTENT).legal?.ok).toBe(true);
  });
});
