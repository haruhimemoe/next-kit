/**
 * @file src/check/standards.ts
 * @desc The routes and content files every haruhime app serves, checked against an app's route
 *       file list (paths under src/app) and content file list (paths under content/). Crawl and
 *       brand are always checked; legal always checks its three routes plus its two content
 *       files; docs joins in once api/v1 exists or a content/docs file does; guides joins in
 *       only once a content/guides file does; the API standard, once api/v1 exists, checks its
 *       three routes plus content/docs/api.mdx. Checks files only: the content registry itself
 *       is never parsed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sun Oct 4, 2026
 */

/** One standard's outcome. `missing` entries carry their own prefix (src/app/... or content/...). */
export type StandardResult = { id: string; label: string; ok: boolean; missing: string[] };

type Requirement = {
  missing: string;
  matches: (app: readonly string[], content: readonly string[]) => boolean;
};

/** A route under src/app, matched against any of `patterns`. */
const route = (name: string, ...patterns: RegExp[]): Requirement => ({
  missing: `src/app/${name}`,
  matches: (app) => app.some((file) => patterns.some((pattern) => pattern.test(file))),
});

/** A file under content/, matched by exact path. */
const content = (path: string): Requirement => ({
  missing: `content/${path}`,
  matches: (_app, files) => files.includes(path),
});

const CRAWL: Requirement[] = [
  route("robots.ts", /^robots\.(ts|js)$/, /^robots\.txt\/route\.(ts|js)$/),
  route("sitemap.ts", /^sitemap\.(ts|js)$/, /^sitemap\.xml\/route\.(ts|js)$/),
  route("llms.txt/route.ts", /^llms\.txt\/route\.(ts|js)$/),
  route("llms-full.txt/route.ts", /^llms-full\.txt\/route\.(ts|js)$/),
  route(".well-known/security.txt/route.ts", /^\.well-known\/security\.txt\/route\.(ts|js)$/),
];

const BRAND: Requirement[] = [route("brand/page.tsx", /^brand\/page\.(tsx|jsx|ts|js)$/)];

/** docs/page.tsx, docs/[x]/page.tsx and docs/[x]/md/route.ts under a section, any segment name. */
const sectionRoutes = (section: string): Requirement[] => [
  route(`${section}/page.tsx`, new RegExp(`^${section}/page\\.(tsx|jsx|ts|js)$`)),
  route(`${section}/[x]/page.tsx`, new RegExp(`^${section}/\\[[^\\]]+\\]/page\\.(tsx|jsx|ts|js)$`)),
  route(`${section}/[x]/md/route.ts`, new RegExp(`^${section}/\\[[^\\]]+\\]/md/route\\.(ts|js)$`)),
];

const LEGAL: Requirement[] = [
  ...sectionRoutes("legal"),
  content("legal/terms.mdx"),
  content("legal/privacy.mdx"),
];
const DOCS: Requirement[] = sectionRoutes("docs");
const GUIDES: Requirement[] = sectionRoutes("guides");

const API: Requirement[] = [
  route("api/v1/me/route.ts", /^api\/v1\/me\/route\.(ts|js)$/),
  route("api/v1/openapi.json/route.ts", /^api\/v1\/openapi\.json\/route\.(ts|js)$/),
  route("api/me/api-key/route.ts", /^api\/me\/api-key\/route\.(ts|js)$/),
  content("docs/api.mdx"),
];

const evaluate = (
  id: string,
  label: string,
  reqs: readonly Requirement[],
  app: readonly string[],
  files: readonly string[],
): StandardResult => {
  const missing = reqs.filter((req) => !req.matches(app, files)).map((req) => req.missing);
  return { id, label, ok: missing.length === 0, missing };
};

/** Route groups like (public)/ don't change the URL, so they are dropped before matching. */
const ungrouped = (file: string): string =>
  file.replace(/(^|\/)\([^)]+\)(?=\/)/g, "").replace(/^\//, "");

/**
 * @function checkStandards
 * @param appFiles {readonly string[]} every file under src/app, relative, "/"-separated
 * @param contentFiles {readonly string[]} every file under content/, relative, "/"-separated
 * @returns {StandardResult[]} crawl and brand always, legal always, docs once api/v1 exists or
 *   a content/docs file does, guides once a content/guides file does, and the API standard once
 *   api/v1 exists
 */
export const checkStandards = (
  appFiles: readonly string[],
  contentFiles: readonly string[] = [],
): StandardResult[] => {
  const app = appFiles.map(ungrouped);
  const hasApi = app.some((file) => file.startsWith("api/v1/"));
  const hasDocsContent = contentFiles.some((file) => file.startsWith("docs/"));
  const hasGuidesContent = contentFiles.some((file) => file.startsWith("guides/"));

  const results: StandardResult[] = [
    evaluate("crawl", "Crawl files", CRAWL, app, contentFiles),
    evaluate("brand", "Brand page", BRAND, app, contentFiles),
    evaluate("legal", "Legal pages", LEGAL, app, contentFiles),
  ];
  if (hasApi || hasDocsContent) {
    results.push(evaluate("docs", "Docs pages", DOCS, app, contentFiles));
  }
  if (hasGuidesContent) {
    results.push(evaluate("guides", "Guides pages", GUIDES, app, contentFiles));
  }
  if (hasApi) {
    results.push(evaluate("api", "Public API", API, app, contentFiles));
  }
  return results;
};
