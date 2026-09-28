# Changelog

All notable changes to `@haruhimemoe/next-kit` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/haruhimemoe/next-kit/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/haruhimemoe/next-kit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/haruhimemoe/next-kit/releases/tag/v0.1.0
