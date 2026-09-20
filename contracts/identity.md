# Identity and digest algorithm

Frozen at R0. Runtime code at R3 must match this.

## Node identity

`id === relativePath`, normalized to `/` separators, original case, no leading `/`. Windows `\` is rejected at the boundary and rewritten to `/` only after a successful confine.

## Semantic edge key

```
{importerId}>|{targetKey}|{syntaxClass}|{edgeClass}
```

`targetKey` is `internal:{nodeId}` or `unresolved:{specifier}` or `external:{packageName}`.

Example: `src/main.ts>|internal:src/app.ts|static-import|value`

## graphDigest

1. Collect unique node ids, sort UTF-8 lexicographically.
2. Collect traversable semantic relations used by the selected default policy (`value` and `mixed` only unless the snapshot `edgePolicy` is `include-type-only`). Each item is `{ key, importerId, targetKey, edgeClass, syntaxClass }` with keys sorted.
3. Serialize as JSON with no whitespace other than that produced by `JSON.stringify` of a stable object:
   `{ "nodes": [...], "edges": [...] }`
4. SHA-256 the UTF-8 bytes. Prefix `sha256:`.

Forbidden inputs: `generatedAt`, `scanId`, layout, observation ranges, content hashes, coverage counts.

## contentManifestDigest

SHA-256 of `JSON.stringify({ files: sorted [{ path, hash }] })` over inventory source files only.

## Evidence range

Offsets are into the decoded source string as UTF-16 code units (JavaScript string indexes). `endOffset` is exclusive. If `contentHash` of the open file ≠ node `contentHash`, the UI must show stale evidence.
