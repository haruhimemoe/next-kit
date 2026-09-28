# Contributing

## Setup

You need [Bun](https://bun.sh) (the version in `package.json`'s `packageManager` field) and Node 22.12 or later (`.nvmrc` has the version CI uses).

```sh
bun install
```

Read [AGENTS.md](./AGENTS.md) first, especially "Generic, not app-specific".

## Making a change

1. Branch from `main` (`feat/<topic>`, `fix/<topic>`).
2. Write a failing test in `tests/`, make it pass, keep commits small and Conventional. A bug found in packs.haruhime.moe or pools.haruhime.moe brings its test case along.
3. Run the full check before opening a PR:

   ```sh
   bun run check && bun run typecheck && bun run test:coverage && bun run test:dist
   ```

   `test:coverage` is `test` with the coverage floor CI enforces: at least 95% of `src/` lines, branches, functions and statements. `bun run check:fix` applies Biome's formatting and import order. CI also runs `bun run check:consumer <zod version>` with zod 4.6.5 and the newest zod. That one typechecks the packed package in a fresh project and needs the npm registry.

4. Add a line to `CHANGELOG.md` under `## [Unreleased]`, in the right [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) section (Added, Changed, Deprecated, Removed, Fixed, Security).

## Tests

- Tests that touch MongoDB use the one in-memory server `tests/setup/mongo-global.ts` starts per run (through this package's own `startMemoryMongo`). Each file gets its own database from `tests/helpers/db.ts`, dropped before each test. The first run downloads a MongoDB binary.
- `tests/helpers/auth.ts` runs real better-auth sign-ins with osu!'s token and `/me` endpoints mocked by msw. No test reaches the network.
- Component tests pick jsdom with a `// @vitest-environment jsdom` line.
- `tests/exports.test.ts`: the exact runtime exports of every entry point, the `exports` map, the browser entry point's imports and the 200-line limit. Changing an export list is a semver decision and needs a changelog line.

Releases are cut by the maintainers.
