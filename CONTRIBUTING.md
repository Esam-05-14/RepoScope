# Contributing

RepoScope is a local, deterministic TypeScript/JavaScript analyzer. It is not an AI wrapper.

## Setup

- Node.js **24.21.0** and npm **11.19.0**
- `npm ci`
- `npm run build`
- `npm run verify`

`npm run demo` opens the loopback UI on `fixtures/esm-baseline`.

Browser tests use Playwright Chromium. Install it with `npx playwright install chromium`. On Windows, `PW_CHANNEL=msedge npx playwright test` can use an installed Microsoft Edge instead.

## Rules

1. Keep one npm lockfile. Do not add pnpm or yarn.
2. Packages must not import application code. `contracts` has no React, Fastify, filesystem, or TypeScript compiler dependency.
3. Pin `typescript@6.0.3` as the parser. Do not use TypeScript 7 as the parser.
4. Bind the API to `127.0.0.1`. Routes accept opaque ids, never filesystem paths from the browser.
5. Tests compare sets and semantics, not graph-layout coordinates.
6. Public fixtures only in `reports/` and CI. Do not commit private repository snapshots.
7. Product language: observed dependency, potential investigation scope, declared value import, not resolved under this configuration.

## Wave discipline

See `docs/waves.md` and `prompts/`. A failed security or data-correctness gate blocks the next change set. Do not fake engine output with fixture JSON in a demo.

## Pull requests

- Run `npm run verify` before you open a PR.
- Prefer small, reviewable changes.
- Update `CHANGELOG.md` for user-visible behavior.
