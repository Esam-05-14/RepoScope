# R2 stop-gate report

- Date: 20 September 2026
- Branch: `implementation`
- Parent commit: `c0c09a4` (R1). R2 sources are not committed unless requested.

## What R2 produced

- Confined filesystem host that denies out-of-root and symlink reads
- Inventory with exclusion list, size limits, SHA-256 content hashes
- `parser-ts` extract of static ESM import / export-from, plus classified omissions
- Compiler `resolveModuleName` through the confined host (`typescript@6.0.3`)
- Source-free `AnalysisSnapshot` with coverage and validation

## Commands actually run

```
npm install --no-fund --no-audit
npm run typecheck   → PASS
npm run lint        → PASS
npm test            → 11 files, 25 tests PASS
npm run build       → PASS
```

## Spike S2

| Check | Status |
| --- | --- |
| `createSourceFile` / `resolveModuleName` on 6.0.3 | PASS |
| `./app.js` → `src/app.ts` on esm-baseline | PASS |
| `@lib/money.ts` paths alias → `src/lib/money.ts` | PASS |

## Results

| Check | Status | Notes |
| --- | --- | --- |
| esm-baseline expected sets | PASS | 5 files, 5 internal value edges |
| esm-revised expected sets | PASS | sixth edge `money → main` |
| unresolved-import visible | PASS | `UNRESOLVED_MODULE` |
| Out-of-root host read | PASS | `readFile` / `fileExists` false; denied audit |
| Relative escape import | PASS | `OUTSIDE_ROOT`, no internal edge |
| Snapshot source-free | PASS | no absolute paths, no source text |

## Remaining limitations

- No reverse BFS, SCC, or compare UI (R3–R5).
- `graphDigest` is computed; algorithm tests land in R3.
- Workspace-package symlink resolution is still P1.
- JavaScript config files are not evaluated.

## Gate

- [x] Security/data-correctness issues: out-of-root read denied
- [x] Ready for R3: yes
