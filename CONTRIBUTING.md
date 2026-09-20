# Contributing

RepoScope is built in ordered waves. See `docs/waves.md` and `prompts/`.

## Current expectation

R0 freezes contracts and versions. Do not add analyzer, server, or UI features until R1 starts.

## Rules

1. One wave at a time. A failed security or data-correctness gate blocks the next wave.
2. npm workspaces and a single committed lockfile. Do not introduce a second package manager.
3. Tests compare sets and semantics, not graph-layout coordinates.
4. Public fixtures only in `reports/` and CI.
5. Do not commit secrets, inspected private source, or absolute machine paths.

## After a wave

Write `reports/rN-stop-gate.md` with files changed, commands actually run, results, remaining limitations, and whether the gate passed. Do not mark a test green if it was not executed.
