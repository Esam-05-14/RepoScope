# R3 stop-gate report

- Date: 21 September 2026
- Branch: `implementation`
- Parent commit: `17ddaa6` (R2). R3 sources are not committed unless requested.

## What R3 produced

- Directed adjacency (`A -> B` means A imports B) with reverse map
- Reverse BFS impact with one predecessor, origin excluded, depth/node truncation, pagination helper
- Iterative Tarjan SCCs with a witness path
- Default policy omits type-only edges
- Digest stability tests (comment-only and moved import)

## Commands actually run

```
npm run typecheck   → PASS
npm run lint        → PASS
npm test            → 16 files, 49 tests PASS
npm run build       → PASS
```

## Results

| Case | Status |
| --- | --- |
| Chain, diamond, disconnected node | PASS |
| Duplicate imports → one semantic edge | PASS |
| Self-loop | PASS |
| Three-node cycle + witness | PASS |
| Type-only cycle hidden by default | PASS |
| Unresolved target (existing fixture) | PASS |
| Malformed source, no invented edges | PASS |
| Truncation max-depth / max-nodes | PASS |
| Baseline money path and cycle group | PASS |
| graphDigest stable across timestamps and line moves | PASS |

## Remaining limitations

- No explorer UI or evidence inspector (R4).
- No snapshot compare (R5).
- Traversal limits are design budgets, not measured product claims.

## Gate

- [x] Data-correctness: algorithm tests pass
- [x] Ready for R4: yes
