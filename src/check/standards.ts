/**
 * @file src/check/standards.ts
 * @desc The routes every haruhime app serves, checked against an app's file list (paths under
 *       src/app). Crawl files always; the API standard once api/v1 exists. Brand and guides
 *       join in phase 2.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

/** One standard's outcome. */
export type StandardResult = { id: string; label: string; ok: boolean; missing: string[] };

type Requirement = { name: string; matches: (files: readonly string[]) => boolean };

const has =
  (...patterns: RegExp[]) =>
  (files: readonly string[]) =>
    files.some((file) => patterns.some((pattern) => pattern.test(file)));

const CRAWL: Requirement[] = [
  { name: "robots.ts", matches: has(/^robots\.(ts|js)$/, /^robots\.txt\/route\.(ts|js)$/) },
  { name: "sitemap.ts", matches: has(/^sitemap\.(ts|js)$/, /^sitemap\.xml\/route\.(ts|js)$/) },
  { name: "llms.txt/route.ts", matches: has(/^llms\.txt\/route\.(ts|js)$/) },
  { name: "llms-full.txt/route.ts", matches: has(/^llms-full\.txt\/route\.(ts|js)$/) },
  {
    name: ".well-known/security.txt/route.ts",
    matches: has(/^\.well-known\/security\.txt\/route\.(ts|js)$/),
  },
];

const API: Requirement[] = [
  { name: "api/v1/me/route.ts", matches: has(/^api\/v1\/me\/route\.(ts|js)$/) },
  {
    name: "api/v1/openapi.json/route.ts",
    matches: has(/^api\/v1\/openapi\.json\/route\.(ts|js)$/),
  },
  { name: "api/me/api-key/route.ts", matches: has(/^api\/me\/api-key\/route\.(ts|js)$/) },
  {
    name: "docs/api/page.tsx",
    matches: has(/^(\([^)]+\)\/)?docs\/(api|\[[^\]]+\])\/page\.(tsx|jsx|ts|js)$/),
  },
];

const evaluate = (id: string, label: string, reqs: Requirement[], files: readonly string[]) => {
  const missing = reqs.filter((req) => !req.matches(files)).map((req) => req.name);
  return { id, label, ok: missing.length === 0, missing };
};

/** Route groups like (public)/ don't change the URL, so they are dropped before matching. */
const ungrouped = (file: string): string =>
  file.replace(/(^|\/)\([^)]+\)(?=\/)/g, "").replace(/^\//, "");

/**
 * @function checkStandards
 * @param files {readonly string[]} every file under src/app, relative, "/"-separated
 * @returns {StandardResult[]} crawl files always, the API standard when api/v1 exists
 */
export const checkStandards = (files: readonly string[]): StandardResult[] => {
  const flat = files.map(ungrouped);
  const results = [evaluate("crawl", "Crawl files", CRAWL, flat)];
  if (flat.some((file) => file.startsWith("api/v1/"))) {
    results.push(evaluate("api", "Public API", API, flat));
  }
  return results;
};
