## Summary

<!-- What changed and why. Link the issue if there is one. -->

## Checklist

- [ ] `bun run check && bun run typecheck && bun run test:coverage && bun run test:dist`
- [ ] A test covers it, ported from the app that had the bug when there is one
- [ ] No app-specific constant: names, paths, limits and messages come from the caller
- [ ] A new, removed or renamed export updates `tests/exports.test.ts` and the README's API section
- [ ] A line under `## [Unreleased]` in `CHANGELOG.md`
