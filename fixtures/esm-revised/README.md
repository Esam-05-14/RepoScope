# esm-revised

Same five files as `esm-baseline`, plus a sixth value import: `src/lib/money.ts` → `src/main.ts`.

That edge pulls the helper into the existing strongly connected component with `main`, `app`, `cycle-a`, and `cycle-b`.

Expected sets: `fixtures/expected/esm-revised.json`
