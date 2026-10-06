<p align="center"><a href="https://github.com/haruhimemoe/next-kit"><picture><source media="(prefers-color-scheme: light)" srcset="https://www.haruhime.moe/brand/repos/next-kit-banner-on-light.svg"><img alt="@haruhimemoe/next-kit" src="https://www.haruhime.moe/brand/repos/next-kit-banner.svg" width="640"></picture></a></p>

# @haruhimemoe/next-kit

The Next.js server plumbing the haruhime.moe tools share. [packs.haruhime.moe](https://packs.haruhime.moe) and [pools.haruhime.moe](https://pools.haruhime.moe) (in beta) each had their own copy, and the copies had started to drift.

- **`/server`:** route helpers. JSON error answers, a JSON body parser with a size cap, a cross-site guard, the client IP, fixed-window rate limits and call budgets in MongoDB, bearer machine auth, where to go after sign-in, and security.txt.
- **`/env`:** zod env parsing that runs on first use, with SKIP_ENV_VALIDATION for CI and a guard that refuses placeholder secrets on a production server.
- **`/mongo`:** one MongoClient per process with Mongoose on the same client, index builds that never take the site down, and frozen collection names.
- **`/auth`:** better-auth with osu! as the only way in, the indexes its collections need, and reading the caller.
- **`/auth-react`:** the browser half: the signed-in marker cookie, the account store and `useAccount`, `RestoreSignedIn`, and the account components (Sign in with osu!, Sign out, the header's account menu, Delete my account) styled with `@haruhimemoe/ui`.
- **`/seo`:** Next.js metadata that keeps each page's canonical, og:url and preview image together, robots.txt with the AI crawler stance written down, sitemap entries with honest lastmod, schema.org JSON-LD builders, and llms.txt. No runtime imports; all four haruhime.moe sites use it.
- **`/testing`:** Vitest helpers: one in-memory MongoDB per run, an msw server that refuses unhandled requests, and a fake env.
- **`/api-keys`:** the shared key format (an app prefix like `hpk_` plus 32 random bytes), a key store over `api_keys`, and the `/api/v1` guard with the standard limits.
- **`/docs`:** a content registry for an app's docs, guides and legal pages: sections, entries, app-made extra entries (like bb's tag pages), the path helpers a dynamic route needs, and `mdxToMarkdown` to turn bb-flavored MDX into plain Markdown. No runtime imports. **`/docs/files`:** reads the markdown files a registry's entries point at and reports drift between the registry and disk (node:fs).
- **`/legal`:** the five-page legal convention (terms, privacy, your-privacy-rights, copyright, disclaimers). A `LegalSite` config, seven plain server-safe blocks (`LegalContact`, `DataWeKeep`, `Processors`, `YourRights`, `DmcaNotice`, `NoWarranty`, `Changes`) an app drops into its own legal MDX, `legalEntries` for the app's content registry, and `legalMarkdownTransform` so those blocks survive `mdxToMarkdown`'s `.md` mirrors and llms-full.txt instead of being dropped as unknown JSX.
- **`/vcs`:** document history in MongoDB on top of `@haruhimemoe/vcs`: one line of revisions per document, saves merged onto whatever landed since their base, revert, diffs, and autosave pruning.

Every name, path, limit and message comes from the caller. There is no root entry point; import a subpath.

## Install

```sh
bun add @haruhimemoe/next-kit zod
# or: npm install @haruhimemoe/next-kit zod
```

`zod` 4.6.5 or later in 4.x is a peer dependency. The other peers are optional, and each subpath needs only its own:

| Subpath | Needs |
| --- | --- |
| `server` | `mongodb` types for the rate limiter and budget |
| `env` | nothing else |
| `mongo` | `mongodb` ^7.6.0, `mongoose` ^9.10.2 |
| `auth` | `better-auth` ^1.7.5, `mongodb`, `@haruhimemoe/osu` 0.2 or 0.3 |
| `auth-react` | `react` ^19.3.0, `next` ^16.3.6, `@haruhimemoe/ui` ^0.14.0 \|\| ^0.15.0 \|\| ^0.16.0 \|\| ^0.17.0 (with its theme set up) |
| `seo` | `next` ^16.3.6 types only (nothing loads at runtime) |
| `testing` | `vitest` ^5.0.1, `msw` ^2.15.0, `mongodb-memory-server` ^11.3.0 |
| `api-keys` | `mongodb` ^7.6.0 |
| `docs` | nothing else |
| `docs/files` | nothing else (`node:fs` is built in) |
| `legal` | `react` ^19.3.0 (types only, for JSX) |
| `vcs` | `mongodb` ^7.6.0, `@haruhimemoe/vcs` ^0.1.0 |

## Use

One file per app wires each piece to its own names.

```ts
// src/env.ts
import { createServerEnv, OSU_APP_PLACEHOLDERS, OSU_APP_SECRET_KEYS, osuAppEnvSchema, readIdSet } from "@haruhimemoe/next-kit/env";

export const serverEnv = createServerEnv({ schema: osuAppEnvSchema, placeholders: OSU_APP_PLACEHOLDERS, secretKeys: OSU_APP_SECRET_KEYS });
export const getServerEnv = serverEnv.get;
export const getDatabaseUri = () => serverEnv.pick(process.env, ["MONGODB_URI"]).MONGODB_URI;
export const getAdminOsuIds = () => readIdSet("ADMIN_OSU_IDS");

// src/lib/db.ts
import { createMongo, ensureIndexes } from "@haruhimemoe/next-kit/mongo";
import { AUTH_INDEX_SPECS } from "@haruhimemoe/next-kit/auth";
import { counterTtlIndex } from "@haruhimemoe/next-kit/server";

export const { getDb, getMongoClient, getModelConnection, connectDb, connectedDb, closeDb } = createMongo({
  dbName: "pools",
  globalKey: "__poolsMongo",
  uri: getDatabaseUri,
  onConnect: async ({ db }) => {
    await ensureIndexes(db, [...AUTH_INDEX_SPECS, counterTtlIndex()]);
  },
});

// src/lib/rate-limit.ts
import { createRateLimiter } from "@haruhimemoe/next-kit/server";

export const limiter = createRateLimiter({ db: connectedDb });
```

A route handler then reads like this:

```ts
import { clientIp, jsonError, parseJsonBody, rateLimitSubject, refuseCrossSite } from "@haruhimemoe/next-kit/server";

export async function POST(request: Request) {
  const foreign = refuseCrossSite(request, { siteUrl: SITE.url, siteTitle: SITE.title });
  if (foreign) return foreign;
  const limited = await limiter.refuseOverLimit(RATE_LIMITS.save, rateLimitSubject(clientIp(request.headers)));
  if (limited) return limited;
  const body = await parseJsonBody(request, saveBodySchema);
  if (!body.ok) return body.response;
  // ...
  return jsonError(404, "Pack not found.");
}
```

Sign-in takes a server file and a client file:

```ts
// src/lib/auth.ts (server)
import { createOsuAuth, getOsuUser } from "@haruhimemoe/next-kit/auth";

export const getAuth = () => {
  const env = getServerEnv();
  return createOsuAuth({
    clientId: env.OSU_CLIENT_ID, clientSecret: env.OSU_CLIENT_SECRET,
    baseURL: env.BETTER_AUTH_URL, secret: env.BETTER_AUTH_SECRET,
    db: getDb(), client: getMongoClient(),
    markerCookie: "pools-signed-in",
    hooks: { afterUserCreate: linkNewEditor },
  });
};

// src/lib/account.ts (browser)
"use client";
import { createAccount, createSignedInMarker } from "@haruhimemoe/next-kit/auth-react";

export const marker = createSignedInMarker("pools-signed-in");
const kit = createAccount(authClient, marker);
export const { store, useAccount, markSignedOut, RestoreSignedIn } = kit;
export const { SignInWithOsu, SignOutButton, AccountMenu, DeleteAccountForm } =
  createAuthComponents(authClient, kit);

// Anywhere, server pages included: only plain data is left to pass.
<SignInWithOsu next={next} />
<AccountMenu items={[{ href: "/new", label: "Make a pool" }, { href: "/account", label: "Account" }]} />
<DeleteAccountForm username={user.username} appName="pools" deletes="This deletes your account and every pool you own. It can't be undone." />
```

Build the auth instance once (memoize `getAuth`), and use the same cookie name on both sides.

SEO: one `Site` per app, then one call per file.

```ts
// src/constants/seo.ts
import { HARUHIME_ORG, type Site } from "@haruhimemoe/next-kit/seo";
export const SEO_SITE: Site = {
  name: "pools",
  url: "https://pools.haruhime.moe",
  title: "osu! tournament mappool builder",
  description: "Build an osu! tournament mappool: search every ranked map under HR or DT, check the content rules, then download it as a pack.",
  ogImages: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "pools" }],
  organization: HARUHIME_ORG,
  parent: { name: "haruhime.moe", url: "https://www.haruhime.moe" },
};

// src/app/layout.tsx: export const metadata = siteMetadata(SEO_SITE);
// src/app/page.tsx:   export const metadata = homeMetadata(SEO_SITE);
// src/app/search/page.tsx
export const metadata = pageMetadata(SEO_SITE, { path: "/search", title: "Search osu! tournament mappools" });
// src/app/robots.ts
export default () => robots(SEO_SITE, { disallow: ["/api/", "/admin"], aiBots: "allow" });
// src/app/sitemap.ts
export default async () => sitemapEntries(SEO_SITE, [["/", "/search"], pools.map((p) => ({ path: `/pools/${p.id}`, lastModified: p.contentUpdatedAt }))]);
// src/app/page.tsx (render with @haruhimemoe/ui's JsonLd)
<JsonLd data={ld.graph(ld.webSite(SEO_SITE, { searchUrlTemplate: "/search?q={search_term_string}" }), ld.webApplication(SEO_SITE, { category: "UtilitiesApplication" }))} />
// src/app/llms.txt/route.ts
export const GET = () => textResponse(llmsTxt({ title: "pools.haruhime.moe", summary: SEO_SITE.description, sections }));
```

### Docs (./docs)

One registry per app, built from its docs, guides and legal entries; the crawl helpers and a dynamic route are built on top of it.

```ts
// src/constants/content.ts
import { defineContent } from "@haruhimemoe/next-kit/docs";

export const CONTENT = defineContent({
  docs: [{ slug: "api", title: "API", description: "The /api/v1 reference.", lastUpdated: "2026-10-04" }],
  guides: [{ slug: "make-a-pack", title: "Make a pack", description: "Build your first mappool.", lastUpdated: "2026-10-04" }],
  legal: [
    { slug: "terms", title: "Terms of service", description: "The rules for using pools.", lastUpdated: "2026-10-04" },
    { slug: "privacy", title: "Privacy policy", description: "What pools stores and why.", lastUpdated: "2026-10-04" },
  ],
});

// src/app/docs/[slug]/page.tsx (and guides/, legal/, the same shape)
import { findEntry } from "@haruhimemoe/next-kit/docs";
import { readContentMarkdown } from "@haruhimemoe/next-kit/docs/files";
import { CONTENT } from "../../../constants/content";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = findEntry(CONTENT, "docs", slug);
  if (!entry) return notFound();
  const markdown = await readContentMarkdown(CONTENT, "docs", slug, { siteUrl: SEO_SITE.url });
  return <Markdown>{markdown}</Markdown>;
}

// src/app/llms.txt/route.ts
import { contentLlmsTxt } from "@haruhimemoe/next-kit/docs";
import { textResponse } from "@haruhimemoe/next-kit/seo";

export const GET = () =>
  textResponse(contentLlmsTxt({ site: SEO_SITE, title: "pools.haruhime.moe", summary: SEO_SITE.description, content: CONTENT }));

// src/app/llms-full.txt/route.ts
import { contentLlmsFull } from "@haruhimemoe/next-kit/docs";
import { readContentMarkdown } from "@haruhimemoe/next-kit/docs/files";

export const GET = async () =>
  textResponse(
    await contentLlmsFull({
      site: SEO_SITE, title: "pools.haruhime.moe", content: CONTENT,
      read: (section, slug) => readContentMarkdown(CONTENT, section, slug, { siteUrl: SEO_SITE.url }),
    }),
  );

// src/app/sitemap.ts
import { contentSitemap } from "@haruhimemoe/next-kit/docs";

export default async () => sitemapEntries(SEO_SITE, [["/", "/search"], contentSitemap(CONTENT)]);

// next.config.ts
import { contentRewrites } from "@haruhimemoe/next-kit/docs";

export default { async rewrites() { return contentRewrites(); } };
```

## Standards check

`next-kit check [dir]` walks `src/app` and, when it exists, `content/` (both under `dir`, default: the current directory) and confirms every standard file exists, so CI catches a missing one before a page does. It checks files only; the content registry itself is never parsed.

```sh
bunx next-kit check
```

Every app is checked against:

- **crawl** (always): `robots.ts`, `sitemap.ts`, `llms.txt/route.ts`, `llms-full.txt/route.ts`, and `.well-known/security.txt/route.ts` (each also accepted as a route handler, like `robots.txt/route.ts`).
- **brand** (always): `brand/page.tsx`.
- **legal** (always): `legal/page.tsx`, `legal/[x]/page.tsx`, `legal/[x]/md/route.ts` (any dynamic segment name), and the five legal convention pages: `content/legal/{terms,privacy,your-privacy-rights,copyright,disclaimers}.mdx`.
- **docs**, once `src/app/api/v1` exists or any `content/docs` file does: `docs/page.tsx`, `docs/[x]/page.tsx`, `docs/[x]/md/route.ts`.
- **guides**, only once a `content/guides` file exists: the same three files under `guides/`. An app with no guides is never asked for them.
- **api**, once `src/app/api/v1` exists: `api/v1/me/route.ts`, `api/v1/openapi.json/route.ts`, `api/me/api-key/route.ts`, and `content/docs/api.mdx`.

Route groups like `(public)/` are ignored, since they don't change the URL. A missing route file prints as `missing src/app/<path>`; a missing content file prints as `missing content/<path>`.

The command prints one `pass` or `FAIL` line per standard, names each missing file, and exits 1 on a failure (or when `src/app` is missing). Add it to CI:

```yaml
- run: bunx next-kit check
```

## API

### server

| Export | What it does |
| --- | --- |
| `jsonError(status, message, code?)` | `{ error: { code, message } }` JSON; the code comes from `ERROR_CODES` unless given. |
| `ERROR_CODES`, `errorCodeFor(status)` | Stable machine codes per status; unknown statuses fall back to `internal_error` (5xx) or `bad_request`. |
| `noStore(response)`, `withHeaders(response, headers)` | Set `Cache-Control: no-store`, or any headers, on the same response. |
| `parseJsonBody(request, schema, { maxBytes?, tooLarge? })` | `{ ok: true, data }` or `{ ok: false, response }`: 415 unless JSON, 413 past the cap (16 KB by default, `MAX_BODY_BYTES`), 400 for bad JSON or a schema refusal. A refinement's `params.code` becomes the error code. Pass `z.strictObject` to refuse unknown keys. |
| `parseIdList(raw, { max, isValid? })` | `?ids=1,2,3` as numbers, or null. Each part is 1 to 10 plain digits; the default check is 1 to `MAX_ID`. |
| `refuseCrossSite(request, { siteUrl, siteTitle })` | A 403 when Origin is foreign or Sec-Fetch-Site says cross-site or same-site, else null. |
| `clientIp(headers)`, `rateLimitSubject(ip)` | Vercel's x-real-ip or first x-forwarded-for, and the counter subject (IPv6 by its /64). |
| `createRateLimiter({ db, collection?, now? })` | `hit(rule, subject, cost?)`, `refuseOverLimit(rule, subject, cost?)` (a no-store 429 or null) and `deleteSubject(rules, subject)`. Counting fails open and logs. |
| `createBudget({ db, global, perSubject?, globalSubject? })` | `take(subject?, nowMs?)` and `gate(subject?)`, a `beforeCall` for `@haruhimemoe/osu` that stays no after its first no. |
| `windowFor`, `rateLimitId`, `rateLimitHeaders`, `retryText`, `tooManyRequests`, `unlimited`, `userSubject` | The fixed-window math, the counter id, RateLimit-* headers, the 429, a result with nothing counted, and `osu:<osuId>`. |
| `counterTtlIndex(collection?)`, `RATE_LIMITS_COLLECTION` | The TTL index that removes spent counters, and the default collection. |
| `refuseWithoutBearer(request, { secret, label, notConfigured, failures?, noStore? })` | Machine auth: null for the right `Bearer` secret, else 503 `not_configured`, 401, or 429 when failures are counted. |
| `sameSecret(given, secret)`, `bearerToken(headers)` | SHA-256 digests compared with `timingSafeEqual`, and the token after `Bearer `. |
| `safeNextPath(raw, { fallback, signInPath? })`, `signInHref(next, signInPath?)` | A same-site path to go to after sign-in (never the sign-in page), and the link carrying it. |
| `safeAbsoluteNext(raw, { hosts, fallback })` | The hub's allowlist for a satellite's full-URL `next`: `new URL()` parsed, `https:` only, no userinfo, `hostname` matched exactly (never a suffix) against `hosts`. A satellite may build this itself as a convenience; the hub re-checking `next` on arrival is the authoritative guard. |
| `buildSecurityTxt({ contactEmail, siteUrl, policyUrl, now, contactUrl? })` | The RFC 9116 body, expiring a year after `now`, with optional `contactUrl` listed before the email. |

### env

| Export | What it does |
| --- | --- |
| `createServerEnv({ schema, placeholders, secretKeys })` | `parse(source)`, `pick(source, keys)`, `get()` (memoized), `reset()` and `assertNoPlaceholderSecrets(source, keys?)`. Errors name variables and never print values. |
| `osuAppEnvSchema`, `OSU_APP_PLACEHOLDERS`, `OSU_APP_SECRET_KEYS` | The five variables both apps need: `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`. |
| `optionalSecret(key, minLength)`, `readIdSet(key)`, `readFlag(key)`, `readOrigin(key, fallback)`, `readOptional(key)` | Read on every call, never memoized, so a bad value breaks only what uses it. |
| `isProductionServer(source)`, `isEnvValidationSkipped(source?)`, `EnvError`, `invalidEnv(keys)`, `BUILD_PHASE` | The production rule (VERCEL_ENV when set, else NODE_ENV, never during `next build`) and the error. |

### mongo

| Export | What it does |
| --- | --- |
| `createMongo({ dbName, identityDbName?, globalKey, uri, maxPoolSize?, serverSelectionTimeoutMS?, onConnect? })` | `getMongoClient`, `getDb`, `getIdentityDb`, `getModelConnection`, `connectDb`, `connectedDb`, `closeDb`. 5 connections and a 5 s timeout by default; a failed connect is retried next call. `onConnect` takes one `{ db, identityDb?, client }` argument; `identityDb` is only present when `identityDbName` was given. Single-DB by default: leave `identityDbName` unset and `getIdentityDb()` throws instead of silently returning your own database. |
| `ensureIndexes(db, specs)` | Builds each `IndexSpec` on its own and returns `{ built, skipped }`. A unique index that existing duplicates break is skipped and logged with the duplicate keys (never for `secret: true`). Never throws. |
| `buildIdentityIndexes(identityDb)` | The hub's own four indexes on `identity`'s collections (user osuId, session token + TTL, account provider+id). Call it from the hub only; a satellite's Atlas user is read-only on `identity`. |
| `ttlIndex(collection, field, seconds?, name?)`, `indexName(spec)` | A TTL index spec, and the name MongoDB gives an index. |
| `defineCollections(names)` | Frozen collection-name constants; throws on an invalid or repeated name. |
| `isDuplicateKeyError(error)`, `DUPLICATE_KEY` | E11000. |

### auth

| Export | What it does |
| --- | --- |
| `createOsuAuth({ clientId, clientSecret, baseURL, secret, db, client, markerCookie, cookieDomain?, trustedOrigins?, signInPath?, hooks?, userFields? })` | better-auth on MongoDB with osu! genericOAuth (identify + public, PKCE). `/update-user` is off, osu! tokens are never stored, osu! is trusted for account linking, API errors land on `/signin?error=<code>`, and the marker cookie follows the session. The hub only passes `cookieDomain` (like `.haruhime.moe`) to put every cookie — session, OAuth state, PKCE — on the parent domain, and `trustedOrigins` for the satellites it may redirect back to. Sessions last 30 days with a 1-day `updateAge` (`SESSION_EXPIRES_IN_SECONDS`, `SESSION_UPDATE_AGE_SECONDS`). |
| `hooks` | `beforeUserCreate`, `beforeAccountCreate` and `beforeSessionCreate` refuse a write by returning false; `afterUserCreate` runs after a new user and never fails the sign-in. |
| `AUTH_INDEX_SPECS`, `AUTH_INDEXES` | One user per osu! id, one account per osu! link, one session per token, sessions by user, and the session TTL. Pass them to `ensureIndexes`. |
| `getOsuUser(auth, headers)`, `toSessionUser(session)` | `{ id, osuId, username, avatarUrl, bannedAt? }` for the caller, or null. Never refuses a banned user by itself. |
| `getSessionUser(source, headers)` | The same, over either the hub's better-auth instance or a `createSessionReader` instance. |
| `requireSession(source, headers)`, `requireAdmin(source, headers, adminOsuIds)` | `getSessionUser`, but null for a banned user too (and, for `requireAdmin`, null when their osu! id isn't in the allowlist). Use these, not `getOsuUser`/`getSessionUser`, wherever a ban must lock someone out. |
| `createSessionReader({ identityDb, secret, hubUrl, cookieName?, updateAgeSeconds?, fetchImpl?, now? })` | A satellite's read of `identity`'s session, with zero database writes: verifies the signed `better-auth.session_token` cookie itself (HMAC-SHA256, `node:crypto`, constant-time) instead of running `betterAuth()`, since better-auth's own `/get-session` writes on refresh. Past `updateAgeSeconds`, fires an injectable, fire-and-forget ping at the hub's `/api/auth/get-session` to extend the session. |
| `IDENTITY_USER_FIELDS` | The identity-only user fields (`locale`, `notificationPrefs`, `bannedAt`, `banReason`, `limits`, `discordId`, `discordUsername`), all `input: false`. Merged into every `createOsuAuth` instance's `additionalFields`, single-DB apps included. |
| `osuProvider`, `osuProfileToUser`, `withoutTokens`, `OSU_PROVIDER_ID`, `OSU_USER_FIELDS` | The pieces `createOsuAuth` is built from. |

### auth-react

| Export | What it does |
| --- | --- |
| `createSignedInMarker(name)`, `markerMaxAge(expiresAt)` | `has(cookieHeader)` and `clear()` for the readable marker cookie. It holds no secret. |
| `createAccount(authClient, marker)` | A page-wide store, `useAccount()`, `markSignedOut()` and a `RestoreSignedIn` with both bound. Export them from a `"use client"` module. |
| `createAccountStore(deps)`, `useAccount(store)`, `sessionFetcher(client)` | The store underneath: one session request per page load, only with the marker, and other tabs caught up when this one is shown again. |
| `RestoreSignedIn({ store, hasMarker, next?, pending? })` | Asks for the session once when the marker is missing; with `next`, goes there after. |
| `osuSignIn(next, signInPath?)` | The body for `authClient.signIn.social`: an error comes back to `/signin?next=<next>`. |
| `safeNextPath`, `signInHref`, `OSU_PROVIDER_ID` | The same as in `server` and `auth`, safe in the browser. |
| `createAuthComponents(authClient, kit)` | Since 0.2.0. The four components below with the client's `signIn.social` and `signOut` and the kit's `useAccount` and `markSignedOut` bound (`AuthComponents`; props `BoundSignInProps`, `BoundSignOutProps`, `BoundAccountMenuProps`, `BoundDeleteAccountProps`: each component's own minus what's bound). Export them from a `"use client"` module. |
| `SignInWithOsu({ next, signIn, signInPath?, label?, pendingLabel?, failedMessage? })` | Since 0.2.0. The large "Sign in with osu!" button. Calls `signIn(osuSignIn(next))`; an error (better-auth's `{ message }` or `{ error: { message } }`, or a throw) shows in a `role="alert"` line and the button comes back. `signInErrorMessage(error, fallback?)` reads it. |
| `SignOutButton({ signOut, onSignedOut, redirectTo?, variant?, className?, label?, pendingLabel? })` | Since 0.2.0. Signs out, runs `onSignedOut` only once the session is gone, then `router.replace(redirectTo ?? "/")` and `router.refresh()`. |
| `AccountMenu({ account, items, signOut, onSignedOut, avatarSrc?, signInPath?, signInLabel?, signOutLabel?, signOutRedirect? })` | Since 0.2.0. A sized blank while loading, a "Sign in" link back to this page when signed out, else ui's `HeaderMenu` with the avatar and name, `items` and Sign out. The avatar is a plain `<img>` (your CSP's img-src must allow a.ppy.sh and osu.ppy.sh); `avatarSrc` defaults to `osuAvatarSrc`. |
| `DeleteAccountForm({ username, appName, deletes, onDeleted, endpoint?, homeHref?, homeLabel?, fetcher? })` | Since 0.2.0. A "Delete my account" button (0.8.0; an in-page `TypeToConfirm` before) that opens ui's `ConfirmDialog`: `deletes` is its description, the username must be typed, then "Delete for good" sends `DELETE endpoint` (default `/api/account`) with `{ username }`. 204: `onDeleted`, "Your account is deleted." (focused) and home. Another 2xx: `onDeleted` and the answer's `notice` after that line, staying. A refusal shows `error.message` (else "Deleting failed (status).") in the dialog; no answer, "Couldn't reach <appName>. Your account is still there." The dialog stays open on both. Needs ui 0.14.0. |
| `osuAvatarSrc(url)`, `OSU_AVATAR_HOSTS` | Since 0.2.0. An osu! avatar URL on https when it's on a.ppy.sh or osu.ppy.sh (a bare path is osu.ppy.sh's), else null. |

### seo

Since 0.3.0. Every helper takes the app's `Site`: `name`, `url` (the canonical origin), `title` (the home page's primary keyword), `titleSuffix?` (defaults to the host), `shortTitleSuffix?` (since 0.4.0, like "pools"), `description`, `locale?` (en_US), `twitter?`, `ogImages`, `organization` and `parent?`.

| Export | What it does |
| --- | --- |
| `siteMetadata(site)` | The root layout's `Metadata`: `metadataBase`, title default "keyword · host" and template "%s · host", the clamped description, `applicationName`, openGraph (type, site name, locale, images) and the twitter card. No canonical (a layout canonical leaks into every child) and no icons (the app's icon files). |
| `homeMetadata(site, { title?, description? })` | `pageMetadata` for `/` with the site's keyword title. |
| `pageMetadata(site, { path, title, titleSuffix?, description?, index?, ogType?, images?, modifiedTime?, publishedTime? })` | An absolute "keyword · host" title (`titleSuffix` defaults to `"auto"`: "keyword · pools" when the full title passes 60 characters and the site sets `shortTitleSuffix`; `"full"`, `"short"` or `"none"` force one), the description clamped to 160, `alternates.canonical` and `openGraph.url` set together to the same absolute URL, and a full openGraph and twitter card (images default to `site.ogImages`: Next replaces a layout's openGraph, it doesn't merge it). `index: false` adds noindex, follow. `ogType: "article"` writes the ISO times it has. Throws on a relative path, another origin or a blank title. |
| `notFoundMetadata(site, what?)` | "Pack not found · host" (shortened like `"auto"`) and noindex, for a `generateMetadata` whose record is missing. |
| `clampDescription(text, max?)`, `DESCRIPTION_MAX` | One line, at most `max` (160) characters: cut at a word, trailing punctuation dropped, "…" added. |
| `pageTitle(site, title, mode?)`, `TITLE_SEPARATOR`, `TITLE_MAX`, `TitleSuffixMode` | "keyword · host", the suffix added once (either suffix already there counts). `mode`: `"full"` (default), `"short"` (the full one when the site has none), `"none"`, or `"auto"` (short past `TITLE_MAX`, 60). |
| `robots(site, { allow?, disallow?, aiBots? })` | `MetadataRoute.Robots`: the `*` group, one group naming the allowed AI bots with the same rules (a bot with its own group ignores `*`), a `Disallow: /` group for blocked ones, the sitemap and the host. `aiBots`: `"allow"` (default), `"block-training"`, or `"block-all"` (Bingbot stays, or the site leaves Bing). |
| `AI_BOTS` | The named crawlers, each `{ userAgent, operator, kind: "training" \| "search", searchEngine? }`: GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, ClaudeBot, Claude-SearchBot, Claude-User, anthropic-ai, Google-Extended, Applebot-Extended, Bingbot, CCBot, Bytespider, meta-externalagent. |
| `sitemapEntries(site, groups)`, `SITEMAP_MAX_URLS` | `MetadataRoute.Sitemap` from groups of paths and `{ path, lastModified?, changeFrequency?, priority? }` records: absolute URLs on the canonical origin, the first entry per URL, `lastModified` only when it's a real date (never made up). Throws past 50,000 URLs or on a priority outside 0 to 1. |
| `ld.graph(...nodes)` | `{ "@context": "https://schema.org", "@graph": nodes }`. `@context` goes only here. |
| `ld.organization(org)`, `HARUHIME_ORG` | Organization with `@id` `https://www.haruhime.moe/#organization` and `sameAs` (GitHub, Discord, npm). |
| `ld.webSite(site, { searchUrlTemplate? })`, `SEARCH_TERM` | WebSite (`#website`) with publisher and parent by `@id`, and a SearchAction when the template holds `{search_term_string}`. |
| `ld.webApplication(site, { category, name?, description?, features?, path?, browserRequirements? })` | WebApplication (`#app`, or `<path>#app` for a sub-tool), free Offer, operatingSystem "Any", publisher the organization. |
| `ld.breadcrumbs(site, trail)`, `ld.itemList(site, items, { name? })` | BreadcrumbList and ItemList, positions from 1, absolute URLs. |
| `ld.faq(items)`, `ld.howTo({ name, description?, steps })` | FAQPage from `{ q, a }` and HowTo with numbered HowToSteps. |
| `ld.techArticle(site, opts)`, `ld.creativeWork(site, opts)`, `ld.dataset(site, opts)` | TechArticle (author defaults to the organization), CreativeWork and Dataset, with `dateModified` only when known and `isBasedOn` paths resolved. |
| `serializeLd(data)` | JSON with `<`, `>`, `&`, U+2028 and U+2029 escaped, safe inside a `<script>`. |
| `llmsTxt({ title, summary, notes?, sections })` | llms.txt (llmstxt.org): H1, blockquote, notes, then `## heading` link lists `- [title](url): note`. Brackets in titles are escaped, spaces and parens in URLs encoded, empty sections left out. |
| `llmsFull(parts, head?)` | llms-full.txt: each `{ title, url?, markdown }` as its own document, separated by `---`. |
| `textResponse(body, { maxAge?, sMaxAge?, type? })` | A 200 `text/plain; charset=utf-8` (or `text/markdown`) with public `Cache-Control` (an hour by default) and nosniff. |

### testing

| Export | What it does |
| --- | --- |
| `startMemoryMongo(project)` | A Vitest globalSetup: one mongodb-memory-server for the run, its URI as `inject("mongoUri")`. |
| `setupTestDb({ connect, db, close, collections })` | Empties the collections before each test, closes after the file. `BETTER_AUTH_COLLECTIONS` lists better-auth's. |
| `setupMsw(...handlers)` | An msw server for the file; an unhandled request is an error. |
| `TEST_OSU_APP_ENV`, `stubOsuAppEnv(overrides?)`, `stubEnv(values)` | A valid fake env and `vi.stubEnv` helpers. |

### api-keys

| Export | What it does |
| --- | --- |
| `API_KEY_BYTES` | Random bytes in a key: 32, shown as 43 base64url characters. |
| `API_KEY_DISPLAY_LENGTH` | Characters of a key shown on account pages and in data exports (prefix + 8): 12. |
| `API_KEY_PREFIX_PATTERN` | Every app prefix: `h`, two lowercase letters, `_`. |
| `generateApiKey(prefix)` | A new key for that prefix; show it once and store only `hashApiKey(key)`. Throws `TypeError` on a bad prefix. |
| `hashApiKey(key)` | A key's SHA-256 hex digest, the only form ever stored. |
| `apiKeyDisplay(key)` | A key's first `API_KEY_DISPLAY_LENGTH` characters. |
| `isApiKeyFormat(prefix, value)` | True only for that prefix plus 43 base64url characters; checked before hashing an untrusted token. |
| `apiKeyToken(headers)` | The single token after `Bearer ` (any case, extra spaces ignored) in a request's `authorization` header, or null. |
| `assertApiKeyPrefix(prefix)` | Throws `TypeError` unless the prefix matches `API_KEY_PREFIX_PATTERN`. |
| `API_KEYS_COLLECTION` | The collection every app keeps its keys in: `api_keys`. |
| `LAST_USED_INTERVAL_MS` | `lastUsedAt` is written at most this often (an hour), to save writes. |
| `apiKeyIndexSpecs(collection?)` | Unique `userId` and unique `hash` (`secret: true`, never logged), for the app's own index list. |
| `createApiKeyStore({ prefix, db, collection?, now? })` | One key per user over MongoDB: `issue(userId)`, `info(userId)`, `revoke(userId)`, `authenticate(key)` (the owner's user id and a `stamp()` to record the use), `deleteFor(userId)` and `ensureIndexes()`. Throws `TypeError` on a bad prefix. |
| `API_LIMITS` | The standard fixed-window limits every haruhime API uses: `api` (60/min per user), `apiWrite` (10/min per user, also counted by `api`), `authFail` (20/min per IP), `keyCreate` (10/hour per user). |
| `API_SERVER_ERROR` | The 500 message when a key lookup or handler throws. |
| `createApiKeyGuard({ store, limiter, resolveCaller, messages, limits?, now? })` | Returns `withApiKey(handler)`: a `/api/v1` route handler that runs `handler(request, caller, context)` only for a good key under `API_LIMITS`, with `RateLimit-*` headers, `Cache-Control: no-store`, a 401 with `WWW-Authenticate: Bearer` for a missing or bad key (counted per IP), and a JSON 500 for a thrown error. No CORS headers: the API is for servers and bots. |

### docs

No runtime imports.

| Export | What it does |
| --- | --- |
| `CONTENT_SECTIONS`, `ContentSection` | The sections a site can have, in display order: `"docs"`, `"guides"`, `"legal"`. |
| `SECTION_LABELS` | The nav label for each section, like "Guides". |
| `defineContent(input)` | Validates and fills in a `Content`: `sections` lists only the non-empty ones, in `CONTENT_SECTIONS` order; `entries` and `extra` hold every section (empty arrays for the ones left out). Throws naming the section and slug (or extra href) for a bad slug (lowercase words, single hyphens), a duplicate slug or extra href, a `lastUpdated` that isn't a real `YYYY-MM-DD` date, or a blank title. |
| `ContentEntry`, `HowToStep` | A markdown-backed page: `slug`, `title`, `navTitle?`, `description`, `lastUpdated` (`YYYY-MM-DD`), `howTo?` (numbered steps). |
| `ExtraEntry` | An app-made page shown in a section's nav and search, like bb's tag pages: `href`, `title`, `navTitle?`, `description`, `group`, `badge?`, `lastUpdated?`, `markdownHref?`. |
| `contentPath(section, slug)`, `markdownPath(section, slug)` | `/section/slug` and `/section/slug.md`. |
| `findEntry(content, section, slug)` | The matching `ContentEntry`, or undefined. |
| `contentParams(content, section)` | `{ slug }[]` for a dynamic route's `generateStaticParams`. |
| `mdxToMarkdown(source, { title, siteUrl, transforms? })` | Converts bb-flavored MDX to plain Markdown, outside fenced code blocks only: CRLF/CR become LF (`transforms` run first, on the whole source); top-level `import`/`export` lines and an `export const x = {` block are dropped; `<Callout type="..." title="...">body</Callout>` becomes a blockquote (`> **Type:** body`, type missing means "Note"); other capitalized JSX tags are removed (text between them stays, lowercase HTML tags stay); a link or image target starting with a single `/` becomes absolute with `siteUrl`; `title` is prepended as a `# ` heading when the first non-blank line isn't one; runs of 3+ blank lines collapse to 2, and the result ends with exactly one newline. |
| `contentLlmsTxt({ site, title, summary, notes?, content, api? })` | The llms.txt body: sections in order Docs, Guides, API, Legal. Each entry links to its absolute `.md` URL with its description as the note; an extra links to `markdownHref` when set, else `href`. An empty section (no entries, no extras, no `api` links) is left out. |
| `contentLlmsFull({ site, title, summary?, content, read, before?, after? })` | The llms-full.txt body: `before`, then every registry entry in section order (title, its absolute page URL, and `read(section, slug)`'s Markdown with its own leading `# ` heading stripped, since `llmsFull` writes the part title as the H1), then `after`. `read` is usually `readContentMarkdown` from `docs/files`. |
| `contentSitemap(content)` | A `SitemapRecord[]` for `seo`'s `sitemapEntries`: one non-empty section's index path (like `/docs`, `lastModified` set to the newest `lastUpdated` among its entries and extras, omitted when none have one), then each entry with its own `lastUpdated`, then each extra with its own `lastUpdated` when set. |
| `contentRewrites()` | The one Next.js rewrite rule that mirrors a content page's `.md` URL (`/docs/x.md`, `/guides/x.md`, `/legal/x.md`) to its route handler (`/docs/x/md`, ...). Pure, takes no registry. |

### docs/files

`node:fs`. Markdown source for an entry lives at `<root>/content/<section>/<slug>.mdx`.

| Export | What it does |
| --- | --- |
| `readContentMarkdown(content, section, slug, { root?, siteUrl, transforms? })` | Reads a registered entry's markdown file and converts it with `mdxToMarkdown` (using the entry's `title`). `root` defaults to `process.cwd()`. Returns null for an unregistered slug; rejects (ENOENT) when the slug is registered but its file is missing. |
| `contentFileDrift(content, { root? })` | `{ missingFiles, unregistered }`: `missingFiles` lists registered entries with no file on disk (like `"guides/x.mdx"`); `unregistered` lists `.mdx` files on disk with no registry entry. `root` defaults to `process.cwd()`. |

### legal

| Export | What it does |
| --- | --- |
| `LEGAL_SLUGS`, `LegalSlug` | The five standard legal page slugs, in order: `"terms"`, `"privacy"`, `"your-privacy-rights"`, `"copyright"`, `"disclaimers"`. |
| `LegalSite` | The config every block and `legalEntries` renders from: `siteName`, `operator`, `contactEmail`, `effectiveDate` (`YYYY-MM-DD`), `stores` (`LegalDataStore[]`), `processors` (`LegalProcessor[]`), `cookies` (`string[]`), optional `hosting` (one sentence on what users can post, shown by `DmcaNotice`). |
| `LegalDataStore`, `LegalProcessor` | One kind of data kept (`what`, `why`), and one third party that processes it (`name`, `purpose`, `link?`). |
| `LegalContact`, `DataWeKeep`, `Processors`, `YourRights`, `DmcaNotice`, `NoWarranty`, `Changes` | The seven blocks. Each takes `{ site: LegalSite }` and renders plain semantic HTML (no `@haruhimemoe/ui`), so it inherits the app's MDX prose styling. `DataWeKeep` skips the cookies list when `site.cookies` is empty. `Processors` links a processor that has a `link`, and plain-texts one that doesn't. `DmcaNotice` prints `site.hosting` only when set. `Changes` also takes an optional `date` for a page updated on its own day. |
| `legalEntries(site, pages?)` | The five `ContentEntry` records (`docs`'s registry shape) for the legal convention, with the default title and description (`site.siteName` filled in) and `lastUpdated` set to `site.effectiveDate`. `pages` overrides any field per slug; everything else keeps the default. |
| `legalMarkdownTransform(site)` | A `transforms` entry for `mdxToMarkdown` (see `docs`): replaces each self-closing legal block tag (`<LegalContact />`, ..., `<Changes />` or `<Changes date="YYYY-MM-DD" />`) with Markdown carrying the same words as its React block, so an app's `.md` mirrors and llms-full.txt don't silently lose the legal text. |

### vcs

| Export | What it does |
| --- | --- |
| `createRevisionStore({ db, collection, codec?, check?, maxRevisions?, maxBytes?, now? })` | A document history over one collection. `codec` is a `@haruhimemoe/vcs` codec (keyed lists, text and ignored paths). `check(value, kind)` runs before every write; throw to refuse (a content filter, say). Throws `TypeError` for a missing collection or a non-positive limit. |
| `revisionIndexSpecs(collection)` | Unique `(docId, seq)`, `authorId`, and `(docId, kind, createdAt)`, for the app's own index list. |
| `DEFAULT_MAX_REVISIONS` | 1000 per document; past it the oldest autosaves go. Saves are never deleted. |
| `DEFAULT_MAX_BYTES` | 1,000,000 bytes of canonical JSON per value; past it a write throws `RangeError`. |
| `COMMIT_ATTEMPTS` | 3: how often a commit reruns when another writer takes its seq. |
| `DEFAULT_LIST_LIMIT`, `MAX_LIST_LIMIT` | History page size: 50 by default, 200 at most. |

The store's methods:

| Method | What it does |
| --- | --- |
| `create(docId, value, author, message?)` | The root revision (seq 0). Throws if the document already has history. |
| `head(docId)`, `get(docId, id)` | One revision with its value, or null. |
| `list(docId, { before?, limit? })` | Revisions newest first, without values. `before` pages by seq. |
| `commit({ docId, base, value, author, kind?, message? })` | `base` is the `{ id, seq }` the client started from; `kind` is `"save"` (default) or `"autosave"`. Returns `committed` (base was the head), `merged` (the head moved on and the value merged onto it cleanly, written as kind `merge`), `unchanged` (the result equals the head, ignoring ignored paths; nothing written), `conflict` (nothing written; `head` and the `ValueMerge` with its conflicts, so the client can resolve and commit again on `head`) or `missing` (no such document, or no revision at or before `base` survives). A pruned `base` merges from the nearest earlier revision. |
| `revert(docId, id, author)` | Commits that revision's value again, as kind `revert`. |
| `diff(docId, fromId, toId)` | The `Change[]` between two revisions, or null. |
| `renameAuthor(authorId, name)` | Rewrites the author's name on every revision (renames, deleted accounts). |
| `removeDoc(docId)` | Deletes the whole history. |
| `pruneAutosaves(docId, olderThan)` | Deletes autosaves older than the date that a later save, merge or revert follows. |
| `indexSpecs()`, `ensureIndexes()` | The indexes, and building them (logs, never throws). |

Notes:

- Run `ensureIndexes()` (or build `revisionIndexSpecs` with your own list) before the first write. The unique `(docId, seq)` index is what stops two writers from both taking the next seq.
- `check` can run more than once for one commit (retries), so keep it free of side effects.
- A stale autosave that merges is kept as kind `merge`, like a save; only plain autosaves are pruned.
- A `base` whose id is another document's revision, or whose seq doesn't match, is `missing`. Only an id that no longer exists (pruned) falls back to the nearest earlier revision.

Who may read a history, and the routes around it, stay the app's.

## Identity (0.12)

0.12 is the identity core behind the shared hub login: `haruhime.moe` is the only app that runs osu! sign-in, every other app (`bb`, `packs`, `pools`) reads the hub's session instead of its own. Two modes:

- **Single-DB (0.11 apps, unchanged).** `createMongo({ dbName, ... })` with no `identityDbName`, `createOsuAuth({ ..., markerCookie: "pools-signed-in" })` with no `cookieDomain`, and `getOsuUser`/`getSessionUser`/`requireSession` over that same instance. Nothing here changes for an app that doesn't opt in, apart from the two breaking changes in the Migration section below (the `onConnect` signature and the new identity user fields).
- **Hub (`haruhime.moe`).**
  ```ts
  // the hub's src/lib/db.ts
  export const { getDb, getIdentityDb, connectDb, ... } = createMongo({
    dbName: "haruhime",
    identityDbName: "identity",
    globalKey: "__hubMongo",
    uri: getDatabaseUri,
    onConnect: async ({ identityDb }) => {
      if (identityDb) await buildIdentityIndexes(identityDb);
    },
  });

  // the hub's src/lib/auth.ts
  export const getAuth = () => createOsuAuth({
    ...,
    db: getIdentityDb(), client: getMongoClient(),
    markerCookie: SHARED_MARKER_COOKIE, // "haruhime-signed-in", from auth-react
    cookieDomain: ".haruhime.moe",
    trustedOrigins: ["https://pools.haruhime.moe", "https://packs.haruhime.moe", "https://bb.haruhime.moe"],
  });
  ```
  Sign-in and the OAuth callback only ever run on the hub, so `cookieDomain` putting the state and PKCE cookies on `.haruhime.moe` too is safe. Re-validate a satellite's `?next=` with `safeAbsoluteNext` before redirecting back to it; the hub is the authoritative check even if the satellite built its own `hubSignInUrl`-style link as a convenience.
- **Satellite (`bb`, `packs`, `pools`, after cutover).** Keep the app's own `createMongo` for its own data, but build a reader instead of `createOsuAuth`:
  ```ts
  export const sessionReader = createSessionReader({
    identityDb: getIdentityDb(), // identityDbName: "identity" on this app's own createMongo too
    secret: getServerEnv().BETTER_AUTH_SECRET, // shared with the hub
    hubUrl: "https://haruhime.moe",
  });
  // in a route or server page:
  const user = await requireSession(sessionReader, request.headers);
  ```
  The reader makes zero database writes (it's a raw cookie-and-Mongo read, not a `betterAuth()` instance), and a satellite's own Atlas user should be `readWrite` on its own database and `read` only on `identity` — app code isn't the boundary, the DB credential is.

**Local dev.** Production shares a cookie across `*.haruhime.moe` via `cookieDomain: ".haruhime.moe"`, but `localhost` subdomains don't share cookies the same way. Run every app under a `*.localhost` host instead (`hub.localhost:3000`, `pools.localhost:3001`, ...) with `cookieDomain: ".localhost"` on the hub's dev config, or use an `lvh.me`-style public DNS wildcard that resolves to `127.0.0.1`. Either way, leave `cookieDomain` unset on a plain `localhost:3000` setup: a single-origin dev server doesn't need cross-subdomain cookies at all, and better-auth's `baseURL` check for `crossSubDomainCookies` requires an actual domain to scope to.

**Cutover.** Deploy the hub with `identity`, run `next-kit migrate-identity --from bb,packs,pools --to identity` (dry run first, then `--execute`), switch each satellite to `createSessionReader`, then run `--drop-old` once every satellite is confirmed working. `migrateIdentity` also rewrites `userId` references in an app's own collections when given `{ collection, field }` per app — the CLI doesn't expose that (no sane flag syntax for a per-app list), so call `migrateIdentity` directly from a one-off script when an app needs it:
```ts
import { migrateIdentity } from "@haruhimemoe/next-kit/check/migrate-identity";
await migrateIdentity(
  [{ id: "packs", db: packsDb, references: [{ collection: "download", field: "userId" }] }],
  identityDb,
  { dryRun: false },
);
```

## Migration

Both apps can drop their copies for the subpaths above. Where the copies differed, this package keeps pools.haruhime.moe's behavior. What changes for packs.haruhime.moe:

- A 503 answers `unavailable`, not `internal_error`.
- `parseJsonBody` says "That request is too large." and "That request isn't valid." by default (pass `tooLarge` to keep "That pack is too large."), and sends a refinement's `params.code` as the error code.
- `?ids=` parsing is strict: `1,,2`, ` 5`, `0x10` and `1e3` are refused.
- `safeNextPath` sends `/signin` as `next` to the fallback.
- `ADMIN_OSU_IDS` is read on every call (`readIdSet`), not memoized with the server env, so a removed admin loses access at the next request.
- Sign-in gains account linking for osu! (a half-deleted account relinks), `onAPIError` to `/signin?error=<code>`, and an `errorCallbackURL` that keeps `next` (`osuSignIn`).
- better-auth's collections get their indexes. The first start after the upgrade builds them; existing duplicate users or links are logged and that index is skipped until they're merged.
- The cron guard is async: `await refuseWithoutBearer(...)`.
- `deleteRateLimitsFor(userId)` becomes `limiter.deleteSubject(rules, userId)`, which escapes the subject instead of requiring an ObjectId.

For pools.haruhime.moe, `createMongo` runs `onConnect` (the privilege check, index builds and backfill) after Mongoose is attached; `connectDb` still rejects when the check fails. Budget counters retry once on a duplicate key, as rate limits already did.

## Compatibility

ES modules for Node 22.12+ on the server. `auth-react` also runs in browsers; its hook and component files keep `"use client"`, and it loads only `react`, `next/navigation.js` and `@haruhimemoe/ui`. `server` loads `node:crypto` for machine auth. `seo` and `docs` load nothing at runtime (Next's types only, or nothing), so they run anywhere; `docs/files` loads `node:fs` and stays server only.

## License

MIT. See [LICENSE](LICENSE).

## Contributing

Questions and feedback are welcome on the haruhime.moe [Discord server](https://haruhime.moe/discord). Bugs and ideas go in [issues](https://github.com/haruhimemoe/next-kit/issues).

See [CONTRIBUTING.md](CONTRIBUTING.md) to work on the package. Changes are logged in [CHANGELOG.md](CHANGELOG.md). Report a vulnerability as [SECURITY.md](SECURITY.md) describes.
