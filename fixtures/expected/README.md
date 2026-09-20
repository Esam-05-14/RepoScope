# Expected fixture sets

Hand-authored adjacency and coverage. Tests compare these sets, not React Flow coordinates.

When the engine exists:

1. Scan the matching directory under `fixtures/`.
2. Compare node ids, semantic value edges, cycle groups, and construct counts.
3. Do not require layout, timestamps, or scan ids to match.
4. `graphDigest` must be stable across two scans of the same bytes.

`tsconfig.json` and README files are configuration/docs, not graph nodes, unless a later rule inventories them. P0 inventory is supported source extensions only.
