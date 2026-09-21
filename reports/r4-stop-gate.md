# R4 stop-gate report

- Date: 21 September 2026
- Branch: `implementation`
- Parent commit: `0ac2046` (R3)

## What R4 produced

- Authenticated scan / snapshot / impact / evidence APIs (opaque ids only)
- Three-pane explorer with a 250/500 graph cap, accessible relation list, and coverage page
- Hash-checked evidence (`current` / `stale` / `unavailable`)
- Playwright path: scan baseline, select `src/lib/money.ts`, open evidence, open coverage

## Commands actually run

```
npm run typecheck   → PASS
npm run lint        → PASS
npm test            → 21 files, 57 tests PASS
npm run build       → PASS
npx playwright test → PASS
```

## Manual breakpoint note

At 1024px the file tree collapses. At 768px the relation list is primary and evidence becomes a bottom sheet. Keyboard `/` focuses search; Escape closes the inspector and restores focus.

## Gate

- [x] Browser investigation path on public fixtures
- [x] Ready for R5: yes
