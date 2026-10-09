# Changelog

All notable changes to `@haruhimemoe/next-kit` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.1] - 2026-10-09

### Fixed
- `auth-react`: `AccountMenu`'s "Sign in" link is 44px tall on a touchscreen (it was 20px).
- `i18n/next-intl`: `createI18nMiddleware`'s app step gets next-intl's response and may be async; when it answers with its own Response, next-intl's Set-Cookie is copied on so the locale rewrite cookie survives.

## [0.15.0] - 2026-10-06

### Added
- `i18n` (new subpath, no next-intl import): `LocaleConfig`, `DEFAULT_LOCALES`, `hasLocale` and `negotiateLocale` (saved user locale, then Accept-Language q-order with a region fallback, then the default). The header is capped at 1 KB and 20 entries before parsing.
- `i18n/next-intl` (new subpath): `createRequestConfig` (injected app and package catalog loaders, merged deeply with the app's last) and `createI18nMiddleware` (next-intl's middleware, "as-needed" prefix, `NEXT_LOCALE` cookie on an optional parent domain, then the app's own step). Plus `mergeMessages` and `resolveRequestConfig`. `next-intl` ^4.14.0 is an optional peer dependency; only this subpath needs it.
- `seo`: `hreflangAlternates(config, path, baseUrl)`.

### Changed
- `seo`: `pageMetadata` takes `alternates: { languages }` and writes it next to the canonical.

## [0.14.0] - 2026-10-06

### Added
- `account` (new subpath): account export and delete across apps. `createAccountHandlers` gives an app POST handlers for `/api/internal/account/{export,delete}` behind its own bearer secret (`ACCOUNT_FANOUT_SECRET`, at least 32 bytes), with a zod-checked `{ userId }` body and no-store answers. `fanOut` lets the hub call every registered app with that app's secret: https only (http on localhost), redirects never followed, a 10 s timeout, three tries for delete, and unset secrets reported as `not_configured`. `exportBundle` packs the results into one JSON download. Plus `secretFor`, `appUrl`, `usableSecret` and the `AccountApp` registry type.
- `inbox` (new subpath): invites and notifications in the identity database. `createInboxStore` (invites upserted by id and held by one app, notifications with an unread filter, `markRead`, a 90-day TTL, `deleteFor` for account delete), `createInboxRoutes` for the hub's `/api/internal/inbox` (the matching secret picks the app, checked against every app with no early exit; another app's invite id is a 409), `createInboxClient` for apps, `matchApp` and `inboxIndexSpecs`.

### Changed
- `mongo`: `buildIdentityIndexes` also builds the inbox indexes.

## [0.13.0] - 2026-10-06

### Added
- `auth`: Discord link for the hub. `discordLinkConfig(env, hubUrl)` (null when `DISCORD_CLIENT_ID` or `DISCORD_CLIENT_SECRET` is unset, which turns the feature off), `createDiscordLinkRoutes` (POST `start` behind `refuseCrossSite`, GET `callback`, POST `unlink`; a signed, 10-minute, host-only state cookie; writes only `discordId` and `discordUsername`, never a token or an `account` row; `?discord=linked|taken|error`), `findUserByDiscordId` (refuses banned users), `DISCORD_SCOPES` and `DISCORD_STATE_COOKIE`.
- `mongo`: `buildIdentityIndexes` adds a partial unique index on `user.discordId` (`IDENTITY_INDEXES.userDiscordId`). A duplicate-key error on link maps to `taken`.
- `api-keys`: scopes. `createApiKeyStore({ scopes })` declares the app's names, `issue(userId, scopes?)` defaults to `["*"]` and refuses undeclared names, `ApiKeyInfo` and `ApiKeyMatch` carry `scopes` (a stored key without the field reads as `["*"]`, so nothing migrates), and `withApiKey(handler, { scope })` answers 403 `insufficient_scope`. New `hasScope`, `normalizeScopes`, `ALL_SCOPES` and `API_INSUFFICIENT_SCOPE`.

## [0.12.2] - 2026-10-06

### Fixed
- `check`'s `next-kit migrate-identity` now skips users without a numeric `osuId` (system accounts) entirely: they're never grouped with other users, never inserted into `identity`, and never get an `idMap` entry, so references pointing at them are left untouched instead of being rewritten to nowhere. `MigrateReport` gains `usersSkipped`; the CLI's summary line reports it alongside `usersSeen`/`usersWritten`.

### Changed
- `auth`'s old `SessionReader` type (the better-auth instance shape used by `getOsuUser`/`getSessionUser`/`requireSession`/`requireAdmin`) is renamed to `OsuAuthInstance`, so `SessionReader` can mean one thing: `createSessionReader`'s own instance type (session-reader.ts), which the barrel used to export only as `SessionReaderInstance` to dodge this exact collision. `session.ts` keeps a `SessionReader` alias of `OsuAuthInstance` for source compatibility, and `session-reader.ts` keeps a `SessionReaderInstance` alias of `SessionReader` (the barrel exports both — `bb`/`packs`/`pools`/`haruhime.moe` all import `SessionReaderInstance`, none import the old `SessionReader`, so this is a non-breaking patch for every real consumer).

## [0.12.1] - 2026-10-06

### Changed
- `check`'s `next-kit migrate-identity` is idempotent now that the hub is live and `identity` holds real users who signed in there directly: a source group's osuId matching an existing identity user merges into it (that user's `_id` and fields win outright, only its own missing fields get filled from the source) instead of refusing on a non-empty identity. Accounts dedupe by `providerId`+`accountId` and API keys by `hash` against identity's own existing rows too, so a second `--execute` run inserts nothing new. `MigrateReport` gains `usersMerged`. `--drop-old` is unchanged: still its own run, still refusing while `identity` is empty.

## [0.12.0] - 2026-10-06

### Added
- Identity core (breaking for every app — see below): `mongo`'s `createMongo` gains `identityDbName`/`getIdentityDb()` so the hub reads an `identity` database on the same client, `buildIdentityIndexes` builds its four indexes, `auth`'s `createOsuAuth` gains `cookieDomain`/`trustedOrigins` for the hub (every better-auth cookie, including OAuth state and PKCE, on the parent domain) and a 30-day session with a 1-day `updateAge`, `createSessionReader` reads a satellite's session with zero database writes (raw cookie verification, no `betterAuth()` instance) and pings the hub to refresh a session past `updateAge`, `getSessionUser`/`requireSession`/`requireAdmin` read either source and refuse a banned user, `server`'s `safeAbsoluteNext` is the hub's exact-hostname allowlist for a satellite's absolute `next` (it returns the normalized URL), `hubSignInUrl` builds a satellite's link to the hub's sign-in page through the same allowlist, and `check`'s `next-kit migrate-identity` merges `bb`/`packs`/`pools` users into `identity` by `osuId` (dry run by default).

### Changed
- **Breaking.** `mongo`'s `onConnect` now takes one `{ db, identityDb?, client }` argument instead of `(db, client)`.
- **Breaking.** The identity user gains `locale`, `notificationPrefs`, `bannedAt`, `banReason`, `limits`, `discordId` and `discordUsername` (`auth`'s `IDENTITY_USER_FIELDS`, merged into every `createOsuAuth` instance's `additionalFields`, single-DB apps included). `OsuSessionUser` and `OsuSession` gain `bannedAt`. **packs' `system` field does not move with this release**: it stays a plain field on packs' own `user` collection for now. Once packs cuts over to the shared `identity` database (after the migration script runs), `system` must move to an app-side profile collection keyed by `userId`, because the identity user row is shared with `bb` and `pools` and has no room for one app's own flag. Do that move in the same deploy that switches packs to `createSessionReader`, not before.


## [0.11.1] - 2026-10-06

### Fixed
- `HARUHIME_ORG`'s email is haruhime@haruhime.moe and its Discord link is https://haruhime.moe/discord.

## [0.11.0] - 2026-10-05

### Added
- `legalMarkdownTransform(site)` in `legal`: a `mdxToMarkdown` `transforms` entry that turns each self-closing legal block tag (`<LegalContact />`, `<DataWeKeep />`, `<Processors />`, `<YourRights />`, `<DmcaNotice />`, `<NoWarranty />`, `<Changes />` and `<Changes date="YYYY-MM-DD" />`) into Markdown carrying the same words as its React block. Without it, an app that drops the legal blocks straight into its `content/legal/*.mdx` loses that text from its `.md` mirrors and llms-full.txt, since `mdxToMarkdown` strips unknown capitalized JSX. The seven blocks' sentences and list items now live in a new `legal/copy.ts`, shared by `blocks.tsx` and `legalMarkdownTransform` so the two outputs can't drift apart; `blocks.tsx`'s rendered output is unchanged.

## [0.10.0] - 2026-10-05

### Changed
- **Breaking.** `next-kit check`'s legal standard requires all five pages of the legal convention: `content/legal/{terms,privacy,your-privacy-rights,copyright,disclaimers}.mdx` (was terms and privacy only).

## [0.9.0] - 2026-10-05

### Added
- `legal` entry point: the five-page legal convention every service ships (terms, privacy, your-privacy-rights, copyright, disclaimers). A `LegalSite` config (site name, operator, contact email, effective date, data stores, processors, cookies), seven plain server-safe blocks an app drops into its own legal MDX (`LegalContact`, `DataWeKeep`, `Processors`, `YourRights`, `DmcaNotice`, `NoWarranty`, `Changes`; no hooks, no `@haruhimemoe/ui`), and `legalEntries(site, pages?)` for the five standard `ContentEntry` records so apps stop hand-writing the same titles and descriptions. next-kit's first `.tsx` entry point. `LegalSite.hosting` adds an optional line to `DmcaNotice`; `Changes` takes an optional per-page `date`.

### Changed
- The `@haruhimemoe/ui` peer range also allows `^0.18.0`.

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

[unreleased]: https://github.com/haruhimemoe/next-kit/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/haruhimemoe/next-kit/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/haruhimemoe/next-kit/compare/v0.8.0...v0.9.0
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
