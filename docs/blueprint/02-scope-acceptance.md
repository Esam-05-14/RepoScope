# 02 Scope and acceptance

## Release levels

- **P0:** Local read-only scan; supported ESM imports and re-exports; separate type edges; graph and list views; source evidence; reverse traversal; cycle groups; coverage; two-snapshot comparison.
- **P1:** Read-only Git commit adapter; declarative boundary rules; stable package build; resource limits documented; persistence and export controls.
- **P2:** Incremental rescans, richer workspace resolution, symbol graph, editor integration, more languages.

## Supported initial syntax

Parse `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs` as applicable. Derive P0 graph edges only from static ESM imports and export-from. Distinguish type-only imports and re-exports. CommonJS may be parsed but is unsupported for extraction.

Record dynamic `import()`, `require`, import-equals, import-type expressions, framework aliases, CSS/assets, declaration-only destinations, and unusual resolver constructs as classified omissions.

## Exclusions

No source execution, package install in the inspected project, automated refactoring, vulnerability detection, runtime tracing, test-impact guarantees, GitHub OAuth, cloud upload, multi-user editing, public filesystem server, or a generic plugin system.

## Acceptance (selected)

A relative import resolves to the expected file and line; a configured alias uses the selected project context; an unresolved import remains visible; a type-only cycle does not appear in the default value-edge cycle view; traversal terminates on cycles; evidence becomes stale if its source hash changes; identical semantic inputs produce an identical graph digest; comparing the same snapshot yields an empty semantic diff.
