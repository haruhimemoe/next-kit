# AGENTS.md

`@haruhimemoe/next-kit`: the Next.js server plumbing packs.haruhime.moe and pools.haruhime.moe share. Six subpath entry points (`server`, `env`, `mongo`, `auth`, `auth-react`, `testing`) and no root entry point. It moved out of the two apps, which each had a copy.

## Rules

- **Generic, not app-specific.** No site name, URL, cookie name, database name, collection list, limit or message belongs here. The caller passes them (`siteUrl`, `markerCookie`, `dbName`, `fallback`, rules). Shared defaults are fine when both apps use the same value (`rate_limits`, `/signin`, the five osu! app variables).
- **Fail the way the apps did.** Rate limits fail open and log. Budgets, machine auth and the placeholder guard fail closed. Index builds and `afterUserCreate` log and never throw. Env errors name a variable and never print its value; a secret index key is never logged.
- **osu! tokens are never stored.** Every account write goes through `withoutTokens`. Identity only comes from osu! (`/update-user` stays disabled).
- **The browser entry point stays light.** `auth-react` loads only `react`, `next/navigation.js` and `@haruhimemoe/ui` at runtime (no next/link or next/image: they are CommonJS, and their default import breaks under nodenext; use a plain `<a>` or `<img>`) (`tests/exports.test.ts` checks). Hook and component files start with `"use client"`; `src/auth-react/index.ts` must not, so server pages can call `safeNextPath` from it.
- **Peers, not dependencies.** Every peer is optional except zod; each subpath needs only its own (README, Install). Pin devDependencies to the apps' exact versions. Don't add runtime dependencies.
- **Public API is pinned** by `tests/exports.test.ts` (every entry point, and the `exports` map in `package.json`), and the README's API section lists every export. A new entry point also goes in `scripts/smoke.mjs` and `scripts/check-consumer.mjs`. Adding, removing or renaming an export is a semver decision: update the test, the README and `CHANGELOG.md` together.
- **Test first**, and port the app's test when a bug comes from an app. Tests never touch the network: MongoDB is in memory, osu! is mocked with msw.
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
- `tests/`: one folder per entry point; `helpers/db.ts` and `helpers/auth.ts`; `setup/mongo-global.ts`; `exports.test.ts`.
- `scripts/smoke.mjs`: imports the built `dist/` of every entry point (`bun run test:dist`).
- `scripts/check-consumer.mjs`: packs the package, installs it with a given zod and the apps' peers, typechecks and runs a strict consumer.
- `.github/workflows/ci.yml`: check, typecheck, coverage, build and pack dry run; `dist` on Node 22.12 and 24; the consumer check on zod 4.6.5 and latest.
- `.github/workflows/release.yml`: publishes to npm when a GitHub release is published.

## Before calling a change done

```sh
bun run check && bun run typecheck && bun run test:coverage && bun run test:dist
```

`test:coverage` is `test` with the 95% coverage floor CI enforces.
