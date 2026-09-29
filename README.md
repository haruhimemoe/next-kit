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
| `auth-react` | `react` ^19.3.0, `next` ^16.3.6, `@haruhimemoe/ui` ^0.5.0 (with its theme set up) |
| `seo` | `next` ^16.3.6 types only (nothing loads at runtime) |
| `testing` | `vitest` ^5.0.1, `msw` ^2.15.0, `mongodb-memory-server` ^11.3.0 |

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
  onConnect: async (db) => {
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
| `buildSecurityTxt({ contactEmail, siteUrl, policyUrl, now })` | The RFC 9116 body, expiring a year after `now`. |

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
| `createMongo({ dbName, globalKey, uri, maxPoolSize?, serverSelectionTimeoutMS?, onConnect? })` | `getMongoClient`, `getDb`, `getModelConnection`, `connectDb`, `connectedDb`, `closeDb`. 5 connections and a 5 s timeout by default; a failed connect is retried next call. |
| `ensureIndexes(db, specs)` | Builds each `IndexSpec` on its own and returns `{ built, skipped }`. A unique index that existing duplicates break is skipped and logged with the duplicate keys (never for `secret: true`). Never throws. |
| `ttlIndex(collection, field, seconds?, name?)`, `indexName(spec)` | A TTL index spec, and the name MongoDB gives an index. |
| `defineCollections(names)` | Frozen collection-name constants; throws on an invalid or repeated name. |
| `isDuplicateKeyError(error)`, `DUPLICATE_KEY` | E11000. |

### auth

| Export | What it does |
| --- | --- |
| `createOsuAuth({ clientId, clientSecret, baseURL, secret, db, client, markerCookie, signInPath?, hooks?, userFields? })` | better-auth on MongoDB with osu! genericOAuth (identify + public, PKCE). `/update-user` is off, osu! tokens are never stored, osu! is trusted for account linking, API errors land on `/signin?error=<code>`, and the marker cookie follows the session. |
| `hooks` | `beforeUserCreate`, `beforeAccountCreate` and `beforeSessionCreate` refuse a write by returning false; `afterUserCreate` runs after a new user and never fails the sign-in. |
| `AUTH_INDEX_SPECS`, `AUTH_INDEXES` | One user per osu! id, one account per osu! link, one session per token, sessions by user, and the session TTL. Pass them to `ensureIndexes`. |
| `getOsuUser(auth, headers)`, `toSessionUser(session)` | `{ id, osuId, username, avatarUrl }` for the caller, or null. |
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
| `DeleteAccountForm({ username, appName, deletes, onDeleted, endpoint?, homeHref?, homeLabel?, fetcher? })` | Since 0.2.0. ui's `TypeToConfirm` on the username, then `DELETE endpoint` (default `/api/account`) with `{ username }`. 204: `onDeleted`, "Your account is deleted." and home. Another 2xx: `onDeleted` and the answer's `notice` after that line, staying. A refusal shows `error.message` (else "Deleting failed (status)."); no answer, "Couldn't reach <appName>. Your account is still there." `deletes` is inline content in a `<p>`. |
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

ES modules for Node 22.12+ on the server. `auth-react` also runs in browsers; its hook and component files keep `"use client"`, and it loads only `react`, `next/navigation.js` and `@haruhimemoe/ui`. `server` loads `node:crypto` for machine auth. `seo` loads nothing at runtime (Next's types only), so it runs anywhere.

## License

MIT. See [LICENSE](LICENSE).

## Contributing

Questions and feedback are welcome on the haruhime.moe [Discord server](https://discord.gg/bKy9kjMV4y). Bugs and ideas go in [issues](https://github.com/haruhimemoe/next-kit/issues).

See [CONTRIBUTING.md](CONTRIBUTING.md) to work on the package. Changes are logged in [CHANGELOG.md](CHANGELOG.md). Report a vulnerability as [SECURITY.md](SECURITY.md) describes.
