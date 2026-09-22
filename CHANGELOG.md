# Changelog

## Unreleased

- L0 language contract: schema document `1.1.0` accepts `py` and `java` nodes, an optional context language, and `WILDCARD_IMPORT`. Writers still emit `1.0.0`. No Python or Java parser. See ADR-R08 through ADR-R11.
- Accept `https://github.com/owner/repo` (CLI and Overview). Clone into a local cache, then run the existing read-only scan and graph.
- P1: scan progress, graph expand, Git commit field, boundary-policy UI, source-free snapshot persistence under the application cache.
- P2: incremental reuse by content hash, tsconfig `files` / project-reference context selection, declared binding names, confined open-in-editor, CommonJS `require("…")` as supported edges.
- Compact investigation brief (UI + `reposcope brief`) plus richer Overview/inspector file facts. No model in the product.
- Hardening (`0.8.1-hard`): single-port inspect lock and `--reopen`, compact/full brief with paste-privacy claims, nested file tree and graph degrees, `package.json` name catalog, `ASSET_UNSUPPORTED`, optional string `import()`, persist cap 20, clone prune, request-URL redaction.
- Relations (`0.9.0-rel`): directory/workspace-package component rollup, boundary files, barrels, co-imported files, clustered file graph, nearby/component views, `node:` / protocol classification, triple-slash path references.
- Performance (`0.9.1-perf`): cached confined FS, context index, resolver cache, skip compiler resolve for cheap classifications, reuse still-valid incremental resolutions, inventory walk caps, bounded audit logs.
- Views (`0.9.2-view`): resolve workspace `package.json` names to inventoried source (JSON exports/entry only), split Your-code vs Libraries lenses, and tighten the graph nodes/filters. Asset omissions record `ASSET_UNSUPPORTED`.

## 0.1.0 — 2026-09-21

First public P0.

- Local CLI: `inspect`, `scan`, `compare`
- Loopback investigation UI: explore, coverage, compare, settings
- Source-free snapshot export/import and structural compare
- Optional Git commit scans via `git ls-tree` / `git cat-file`
- JSON boundary policy evaluation
- `npm run verify` (typecheck, lint, build, unit/integration, Playwright, benchmark)
