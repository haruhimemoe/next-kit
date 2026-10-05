# Changelog

All notable changes to `@haruhimemoe/next-kit` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-10-05

### Changed
- **Breaking.** The `@haruhimemoe/ui` peer range is now `^0.14.0 || ^0.15.0 || ^0.16.0 || ^0.17.0` (0.15 to 0.17 not yet published): `DeleteAccountForm` needs ui's `ConfirmDialog`.
- `DeleteAccountForm` is a "Delete my account" button that opens a dialog: what goes is its description, the username is typed there, and a refusal or no answer is said in the dialog, which stays open. Once the account is deleted, focus moves to the "Your account is deleted." line.
- The account components use ui's text tones (`Text`, `textClasses`) and Button's own width. No change in how they look.

## [0.7.0] - 2026-10-05

### Added
- `vcs` entry point: `createRevisionStore`, document history in MongoDB on top of `@haruhimemoe/vcs` (a new optional peer). Saves name their base revision and merge onto anything newer; conflicts write nothing and come back for the client to resolve. Also revert, diffs, author renames, history removal and autosave pruning.

## [0.6.2] - 2026-10-04

### Changed
- Peer range accepts @haruhimemoe/ui 0.12 and 0.13 (0.13 not yet published).

## [0.6.1] - 2026-10-04

### Changed
- Peer range accepts @haruhimemoe/ui 0.11.

## [0.6.0] - 2026-10-04

### Added
- `docs` entry point: a content registry (`defineContent`, `CONTENT_SECTIONS`, `SECTION_LABELS`) and the path helpers (`contentPath`, `markdownPath`, `findEntry`, `contentParams`) for an app's docs, guides and legal pages, plus app-made extra entries like bb's tag pages. No runtime imports.
- `mdxToMarkdown` in `docs`: converts bb-flavored MDX to plain Markdown (callouts to blockquotes, import/export lines dropped, capitalized JSX removed, root-relative links and images absolutized, a title heading added when missing). Content inside fenced code blocks is left untouched. Still no runtime imports.
- `docs/files` entry point: `readContentMarkdown` reads and converts a registered entry's markdown file, and `contentFileDrift` compares a registry against the files on disk. Loads `node:fs`.
- `contentLlmsTxt`, `contentLlmsFull`, `contentSitemap` and `contentRewrites` in `docs`: llms.txt (sections in order Docs, Guides, API, Legal, empty ones left out), llms-full.txt (each entry's own leading H1 stripped, since `llmsFull` writes the part title), sitemap records per section (an index path, each entry, each extra) and the one rewrite rule for a content page's ".md" mirror. Built on `llmsTxt`/`llmsFull`/`SitemapRecord` from `seo`. Still no runtime imports.

### Changed
- **Breaking (check only).** `next-kit check` now also checks files under `content/` and adds the `brand` and `legal` standards: `brand/page.tsx` and `legal/page.tsx` plus `legal/[x]/page.tsx`, `legal/[x]/md/route.ts`, `content/legal/terms.mdx` and `content/legal/privacy.mdx` are required on every app. A `docs` standard (`docs/page.tsx`, `docs/[x]/page.tsx`, `docs/[x]/md/route.ts`) joins in once `src/app/api/v1` exists or any `content/docs` file does; a `guides` standard joins in only once a `content/guides` file does. The `api` standard drops its `docs/api/page.tsx` requirement in favor of `content/docs/api.mdx`. `checkStandards` takes a second `contentFiles` argument; `StandardResult.missing` entries now carry their own `src/app/` or `content/` prefix. This is a 0.x minor: an app with no `/brand`, `/legal` route or legal content fails `next-kit check` in CI until it adds them.
- `@haruhimemoe/ui` peer range also covers 0.10.0 (not yet published).

## [0.5.0] - 2026-10-04

### Added
- `buildSecurityTxt` takes `contactUrl`, listed before the email.
- `api-keys` entry point: the shared key format (`h` + two letters + `_`, then 32 random bytes), `createApiKeyStore` over `api_keys`, and `createApiKeyGuard` with `API_LIMITS` for `/api/v1` routes. Moved from packs.
- `next-kit check` bin: fails when an app is missing a standard route.

### Changed
- `@haruhimemoe/ui` peer range now covers 0.5 through 0.9.

## [0.4.0] - 2026-09-28

### Added

- `seo`: a short title suffix. `Site.shortTitleSuffix` (like "pools") and `pageMetadata`'s `titleSuffix` option: `"auto"` (the default) keeps "keyword · host" and switches to "keyword · pools" only when the full title passes 60 characters (`TITLE_MAX`) and the site sets a short suffix; `"full"`, `"short"` and `"none"` force one. `pageTitle` takes the same mode (default `"full"`) and `notFoundMetadata` shortens like `"auto"`. Sites without `shortTitleSuffix` get the same titles as before.

## [0.3.0] - 2026-09-28

### Added

- `@haruhimemoe/next-kit/seo`, for www, packs, pools and bb. No runtime imports (Next's types only).
  - Metadata: `siteMetadata`, `homeMetadata`, `pageMetadata`, `notFoundMetadata`, `pageTitle` ("keyword · host") and `clampDescription` (160 characters, cut at a word). `pageMetadata` always sets the canonical and og:url together and always writes a full openGraph with the site's images, so a page never loses its preview.
  - `robots` with the AI crawler stance written down (`"allow"`, `"block-training"` or `"block-all"`) and the `AI_BOTS` table.
  - `sitemapEntries`: absolute URLs, one per URL, lastmod only when it's a real date, and an error past 50,000 URLs.
  - JSON-LD builders in `ld` (graph, Organization, WebSite with SearchAction, WebApplication, BreadcrumbList, ItemList, FAQPage, HowTo, TechArticle, CreativeWork, Dataset) with stable `@id`s, `HARUHIME_ORG`, and `serializeLd` for script-safe JSON.
  - `llmsTxt`, `llmsFull` and `textResponse` for /llms.txt and /llms-full.txt.

## [0.2.1] - 2026-09-28

### Fixed

- The `@haruhimemoe/osu` peer range also allows `^0.4.0`, so apps on osu 0.4.0 install without npm's ERESOLVE.

## [0.2.0] - 2026-09-28

### Added

- `@haruhimemoe/next-kit/auth-react`: the account components, styled with `@haruhimemoe/ui` (a new optional peer, ^0.5.0). `SignInWithOsu`, `SignOutButton`, `AccountMenu` (ui's HeaderMenu with the app's links) and `DeleteAccountForm` (type the username, then one DELETE), with `createAuthComponents(authClient, kit)` to bind the app's client and account kit. Moved from packs, pools and bb, which each had a copy.
- `osuAvatarSrc` and `OSU_AVATAR_HOSTS`: an osu! avatar URL only from a.ppy.sh or osu.ppy.sh. Moved from pools and bb.
- `signInErrorMessage`: reads better-auth's flat or nested error message, as packs did.

### Changed

- `auth-react` now also loads `@haruhimemoe/ui` at runtime.

## [0.1.0] - 2026-09-28

### Added

- `@haruhimemoe/next-kit/server`: `jsonError`, `ERROR_CODES`, `noStore`, `parseJsonBody` with a per-route cap, `parseIdList`, `refuseCrossSite`, `clientIp` and `rateLimitSubject`, `createRateLimiter` and `createBudget` over one MongoDB counter shape, `refuseWithoutBearer` and `sameSecret` for machine routes, `safeNextPath`, `signInHref` and `buildSecurityTxt`. Moved from packs.haruhime.moe and pools.haruhime.moe, taking pools' behavior where they differed.
- `@haruhimemoe/next-kit/env`: `createServerEnv` with SKIP_ENV_VALIDATION and the production placeholder guard, the osu! app's five variables, and per-call readers (`optionalSecret`, `readIdSet`, `readFlag`, `readOrigin`).
- `@haruhimemoe/next-kit/mongo`: `createMongo` (one client per process, Mongoose on the same client, an `onConnect` hook), `ensureIndexes` that skips and logs an index existing duplicates break, `ttlIndex` and `defineCollections`.
- `@haruhimemoe/next-kit/auth`: `createOsuAuth` (better-auth with osu! genericOAuth, no stored osu! tokens, trusted account linking, errors to the sign-in page, the signed-in marker cookie, guard hooks and extra user fields), `AUTH_INDEX_SPECS` and `getOsuUser`.
- `@haruhimemoe/next-kit/auth-react`: `createSignedInMarker`, `createAccountStore`, `useAccount`, `createAccount`, `RestoreSignedIn` and `osuSignIn`.
- `@haruhimemoe/next-kit/testing`: `startMemoryMongo`, `setupTestDb`, `setupMsw` and the fake osu! app env.

[unreleased]: https://github.com/haruhimemoe/next-kit/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/haruhimemoe/next-kit/compare/v0.7.0...v0.8.0
[0.6.2]: https://github.com/haruhimemoe/next-kit/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/haruhimemoe/next-kit/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/haruhimemoe/next-kit/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/haruhimemoe/next-kit/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/haruhimemoe/next-kit/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/haruhimemoe/next-kit/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/haruhimemoe/next-kit/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/haruhimemoe/next-kit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/haruhimemoe/next-kit/releases/tag/v0.1.0
