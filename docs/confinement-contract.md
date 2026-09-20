# Root confinement contract

Frozen at R0. The CLI canonicalizes one root before the API starts. The browser never supplies a filesystem path.

## Allowed reads

- Regular files inside the canonical root after `realpath`-style resolution.
- `tsconfig.json` / `jsconfig.json` inside that root, parsed through the TypeScript config API on the confined host.
- Git object reads (P1 only) from the selected commit via `execFile` argument arrays, never shell strings.

## Denied by default

- Symlink and junction traversal.
- Paths that escape the root after canonicalization, including `..`, mixed separators, UNC, and `\\?\` prefixes.
- Alias candidates whose resolved file sits outside the root (not an internal node).
- Config that `extends` a file outside the root (unsupported; diagnostic).
- `.git` working files as source inventory (the object store is a P1 adapter, not a source walk).
- `node_modules`, common output dirs (`dist`, `build`, `coverage`, `.next`, `out`), binary files, and known credential filenames (`.env`, `*.pem`, `id_rsa`, `credentials.json`, and the list maintained at R2).
- Inspected project JavaScript config as executable code. No `import()` of repo config. No `npm install` in the inspected tree.

## Limits (design, to validate)

| Limit | Provisional value | On hit |
| --- | --- | --- |
| Source files | 5,000 | Partial scan, truncation recorded |
| Per source file | 1 MiB | Skip file, coverage reason |
| Analyzed source bytes | 100 MiB | Partial scan |
| Evidence response | bounded slice | Reject oversize |
| Request body | schema max | 413 / validation error |

## Identity vs location

- Portable node id = repository-relative path, forward slashes, original case.
- Local absolute root is session metadata, never a node id and never a default export field.
- Repository identity is generated once per selected root. Comparing two folders with the same name is not an automatic match.

## Evidence freshness

`contentHash` is SHA-256 of raw bytes. Evidence offsets are zero-based UTF-16 into consistently decoded text, exclusive end. Displayed line/column are one-based. If the hash no longer matches, evidence is stale and must be shown as stale.

## Writes

Nothing is written into the inspected repository by default. Scan state and exports live in application-owned storage or an explicit user destination.
