# Implementation waves

| Wave | Build | Stop evidence | App code? |
| --- | --- | --- | --- |
| R0 | Contracts, versions, spikes specified | This pack + `reports/r0-stop-gate.md` | No |
| R1 | Workspaces, CLI shell, loopback session, tests | Fresh build; authenticated health; negative auth | Shell only |
| R2 | Confined inventory, parser, observations, coverage | Fixture outputs; no out-of-root read | Engine |
| R3 | Adjacency, reverse BFS, SCC, digest | Algorithm tests | Engine |
| R4 | Explorer, evidence, coverage, list alternative | Browser checklist; stale evidence | UI |
| R5 | Source-free export/import; snapshot diff | Identical compare empty; revised fixture exact | Engine+UI |
| R6 | Optional Git adapter + boundary policy | Dirty worktree unchanged; historical isolation | P1 only |
| R7 | Package, benchmarks, audit, docs, demo | Fresh-clone reproduction | Release |

Git revision analysis moves out of a five-day sprint if P0 is behind. Never fake commit labels on working-tree snapshots.

## Scope-cut order

Cut animation, automatic Git scanning, advanced boundary editing, watch mode, and export polish before cutting evidence, coverage, path confinement, or the test harness.
