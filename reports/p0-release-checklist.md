# P0 release checklist

- Date: 21 September 2026
- Branch: `implementation`

## Required before a public repository

- [x] MIT `LICENSE`
- [x] `SECURITY.md` does not invent a maintainer inbox
- [x] `CONTRIBUTING.md` matches the current product
- [x] GitHub Actions `verify` workflow pins Node 24.21.0
- [x] README leads with the problem, a real screenshot, and a 90-second demo
- [x] Demo uses the real engine on public fixtures
- [x] `npm run typecheck`, `npm run lint`, `npm test` (58 tests), `npm run build`
- [x] Playwright: baseline evidence, compare added edge, unresolved coverage (3 passed)
- [x] Browser path: baseline → money.ts evidence → compare revised → unresolved coverage → settings clear

## Product language

Uses observed dependency, potential investigation scope, declared value import, and not resolved under this configuration. Does not claim that a change will break N files.

## Not included in P0

- npm registry publish
- Hosted public demo
- Invented security email
- Private repository artifacts
