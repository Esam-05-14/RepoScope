# 05 Data contracts

Import observations and resolved dependency edges are different records. Every supported or detected unsupported import-like construct produces an observation. Only observations with a supported, resolved internal target produce traversable internal edges.

## Identity

- Relative paths: forward slashes, original case.
- On case-insensitive filesystems, detect collisions; do not lowercase everything.
- `contentHash`: SHA-256 of raw bytes, encoded `sha256:<hex>`.
- Evidence: zero-based UTF-16 offsets, exclusive end; display 1-based line/column.
- Occurrence id: one source statement in one snapshot.
- Semantic edge key: importer + target or unresolved specifier + syntax class + value/type class.
- Graph adjacency deduplicates the same semantic relation; the inspector keeps all occurrences.
- Moving an import down one line changes evidence location, not the semantic relationship.

## Digests

`graphDigest` hashes sorted node ids and sorted normalized semantic relations only. Never include timestamps, scan ids, array iteration order, or layout coordinates.

`contentManifestDigest` hashes sorted `{ relativePath, contentHash }` so a comment-only change can change a file hash without claiming the graph changed.

## Validation

Reject unknown major schemas, missing node references, duplicate node ids, impossible ranges, excessive arrays, unsafe paths, and prototype-polluting keys. Source-free imported snapshots may render; mark evidence unavailable until the exact local source is reattached and the hash matches.
