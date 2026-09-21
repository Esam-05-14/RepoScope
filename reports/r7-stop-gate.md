# R7 stop-gate report

- Date: 21 September 2026
- Branch: `implementation`

## What R7 produced

- `npm run verify` runs typecheck, lint, build, unit/integration, and Playwright in that order, then a 1,000-file benchmark
- Public README follows the GitHub presentation structure and uses a real explorer screenshot from the Playwright path
- `SECURITY.md` has no invented maintainer inbox
- Demo uses the real engine on `fixtures/esm-baseline`

## Verify order

1. `npm run typecheck`
2. `npm run lint`
3. `npm run build`
4. `npm test`
5. `npx playwright test`
6. `node scripts/benchmark.mjs 1000` (published even if targets are missed)

## Benchmark (generated 1,000-file fixture, this machine)

| Metric | Measured |
| --- | --- |
| Files | 1000 |
| Semantic edges | 999 |
| Elapsed | 841 ms |
| Throughput | ~1189 files/s |

Targets are not a product claim. These numbers are published as measured.

## Gate

- [x] P0 investigation and compare cases pass
- [x] No private repository artifacts in `reports/`
- [x] Ready to treat as a verified local P0
