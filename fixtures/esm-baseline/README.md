# esm-baseline

Five source files and five supported internal value-import observations.

- Chain: `src/main.ts` → `src/app.ts` → `src/lib/money.ts`
- Separate value cycle: `src/app.ts` → `src/cycle-a.ts` → `src/cycle-b.ts` → `src/app.ts`
- `src/lib/money.ts` is not a cycle member

Expected sets: `fixtures/expected/esm-baseline.json`
