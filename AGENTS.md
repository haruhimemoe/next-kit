# AGENTS.md

`@haruhimemoe/next-kit`: the Next.js server plumbing packs.haruhime.moe and pools.haruhime.moe share. Nine subpath entry points (`server`, `env`, `mongo`, `auth`, `auth-react`, `testing`, `seo`, `api-keys`, `vcs`) and no root entry point. `seo` serves all four haruhime.moe sites (www, packs, pools, bb). It moved out of the two apps, which each had a copy. The package also ships one bin, `next-kit` (`dist/check/cli.js`), for `next-kit check` in CI.

## Rules

- **Generic, not app-specific.** No site name, URL, cookie name, database name, collection list, limit or message belongs here. The caller passes them (`siteUrl`, `markerCookie`, `dbName`, `fallback`, rules). Shared defaults are fine when both apps use the same value (`rate_limits`, `/signin`, the five osu! app variables). One exception by design: `seo`'s `HARUHIME_ORG` (the organization every site's JSON-LD points at, so the four sites stay one entity); a change to it is a release.
- **Fail the way the apps did.** Rate limits fail open and log. Budgets, machine auth and the placeholder guard fail closed. Index builds and `afterUserCreate` log and never throw. Env errors name a variable and never print its value; a secret index key is never logged.
- **osu! tokens are never stored.** Every account write goes through `withoutTokens`. Identity only comes from osu! (`/update-user` stays disabled).
- **The browser entry point stays light.** `auth-react` loads only `react`, `next/navigation.js` and `@haruhimemoe/ui` at runtime (no next/link or next/image: they are CommonJS, and their default import breaks under nodenext; use a plain `<a>` or `<img>`) (`tests/exports.test.ts` checks). Hook and component files start with `"use client"`; `src/auth-react/index.ts` must not, so server pages can call `safeNextPath` from it.
- **Peers, not dependencies.** Every peer is optional except zod; each subpath needs only its own (README, Install). Pin devDependencies to the apps' exact versions. Don't add runtime dependencies.
- **Public API is pinned** by `tests/exports.test.ts` (every entry point, and the `exports` map in `package.json`), and the README's API section lists every export. A new entry point also goes in `scripts/smoke.mjs` and `scripts/check-consumer.mjs`. Adding, removing or renaming an export is a semver decision: update the test, the README and `CHANGELOG.md` together.
- **Test first**, and port the app's test when a bug comes from an app. Tests never touch the network: MongoDB is in memory, osu! is mocked with msw.
- **`seo` has no runtime imports.** Next's types only (`import type`), so it runs in any route, edge or browser (`tests/exports.test.ts` checks). Metadata invariants: `pageMetadata` always sets `alternates.canonical` and `openGraph.url` together and always writes a full openGraph with images (Next replaces a layout's openGraph, it doesn't merge it). Sitemaps and JSON-LD never make up a date. JSON-LD `@context` goes only on `ld.graph`.
- **Small files.** Every file in `src/` stays under 200 lines (`tests/exports.test.ts` checks).
- **Changelog.** Keep a Changelog 1.1.0. User-visible changes get a line under `## [Unreleased]`. Never rewrite a released entry.
- **Code style.** Biome (2 spaces, double quotes, trailing commas, 100 columns). Every file starts with the `@file / @desc / @author / @created / @modified` header. Exported functions get JSDoc with `@function`, `@param`, `@returns` (and `@throws` when they throw); every other export (a type, constant or class) gets a one-line `/** */`. Imports in `src/` use `.js` extensions (`next/navigation.js` too). Plain, short sentences in docs and messages, no em dashes.

## Layout

- `src/server/`: `errors.ts` (JSON errors, headers), `body.ts` (`parseJsonBody`, `parseIdList`), `cross-site.ts`, `client-ip.ts`, `counter.ts` (the window math and counter document limits and budgets share), `rate-limit.ts`, `budget.ts`, `machine-auth.ts` (loads `node:crypto`), `safe-next.ts` (browser-safe; `auth-react` re-exports it), `security-txt.ts`.
- `src/env/`: `server-env.ts` (`createServerEnv`, the production rule), `optional.ts` (per-call readers), `osu-app.ts` (the five variables), `errors.ts` (`EnvError`).
- `src/mongo/`: `client.ts` (`createMongo`), `indexes.ts` (`ensureIndexes`), `collections.ts`, `duplicate.ts`.
- `src/auth/`: `create.ts` (`createOsuAuth`), `osu.ts` (provider, profile mapping, `withoutTokens`), `osu-id.ts` (the provider id alone, for the browser), `indexes.ts`, `session.ts`.
- `src/auth-react/`: `marker.ts`, `account-store.ts`, `use-account.ts`, `RestoreSignedIn.tsx`, `sign-in.ts`, `avatar.ts` (`osuAvatarSrc`), the ui-styled components `SignInWithOsu.tsx`, `SignOutButton.tsx`, `AccountMenu.tsx`, `DeleteAccountForm.tsx`, and `auth-components.tsx` (`createAuthComponents`).
- `src/testing/`: `mongo.ts`, `msw.ts`, `env.ts`.
- `src/seo/`: `site.ts` (`Site`, `HARUHIME_ORG`, `pageTitle` and the short suffix modes, URL/date/@id helpers), `describe.ts` (`clampDescription`), `metadata.ts`, `robots.ts` (`AI_BOTS`), `sitemap.ts`, `ld-site.ts` (graph, Organization, WebSite, WebApplication, breadcrumbs, ItemList), `ld-content.ts` (FAQ, HowTo, TechArticle, CreativeWork, Dataset), `ld.ts` (the `ld` namespace, `serializeLd`), `llms.ts` (`llmsTxt`, `llmsFull`, `textResponse`).
- `src/api-keys/`: `format.ts` (the key format, `generateApiKey`, `hashApiKey`, loads `node:crypto`), `store.ts` (`createApiKeyStore` over `api_keys`), `guard.ts` (`createApiKeyGuard`, `API_LIMITS`).
- `src/vcs/`: `types.ts` (options, `CommitResult`, `RevisionStore`), `options.ts` (defaults), `docs.ts` (the stored shape, `revisionIndexSpecs`), `read.ts` (head, get, list, the nearest earlier revision), `write.ts` (the one gated insert: size cap, `check`, cap pruning), `commit.ts` (create, commit, revert, the retry loop), `maintenance.ts` (diff, renames, removal, pruning), `index.ts` (`createRevisionStore`). Loads `mongodb` and `@haruhimemoe/vcs`.
- `src/check/`: `standards.ts` (`checkStandards`, the crawl and API route standards), `cli.ts` (the `next-kit check` bin: `runCheck`, walks `src/app`). Not a subpath entry point; `package.json`'s `bin` points at `dist/check/cli.js` instead, and `tests/exports.test.ts`'s 200-line check covers it alongside the entry points.
- `tests/`: one folder per entry point, plus `check/` (with `fixtures/`, empty files, not real code); `helpers/db.ts` and `helpers/auth.ts`; `setup/mongo-global.ts`; `exports.test.ts`.
- `scripts/smoke.mjs`: imports the built `dist/` of every entry point (`bun run test:dist`).
- `scripts/check-consumer.mjs`: packs the package, installs it with a given zod and the apps' peers, typechecks and runs a strict consumer.
- `.github/workflows/ci.yml`: check, typecheck, coverage, build and pack dry run; `dist` on Node 22.12 and 24; the consumer check on zod 4.6.5 and latest.
- `.github/workflows/release.yml`: publishes to npm when a GitHub release is published.

## Before calling a change done

```sh
bun run check && bun run typecheck && bun run test:coverage && bun run test:dist
```

`test:coverage` is `test` with the 95% coverage floor CI enforces.
