# ADR-R09: One evidence coordinate system

**Status:** Accepted (L0)

## Problem

Evidence offsets are zero-based UTF-16 indexes into the decoded source string, with an exclusive end. Python encoding cookies and Java charset declarations are not UTF-16 on disk. A second coordinate system would make evidence, staleness checks, and the inspector language-specific.

## Decision

Every language decodes source bytes to a JavaScript string, then records offsets in that string. Displayed line and column stay one-based. Bytes that cannot be decoded are `ENCODING_UNSUPPORTED` and produce no evidence slice. The content hash remains SHA-256 of the raw bytes, so a decode choice does not hide a byte change.

## Alternatives

- UTF-8 byte offsets for Python and UTF-16 for TypeScript: rejected. The inspector and stale-evidence check would need two interpretations of the same range fields.
- Re-decode with the inspected runtime: rejected. That starts the project's interpreter.

## Impact

Security: decoding is local and bounded by the existing per-file byte cap. Compatibility: TypeScript evidence offsets do not change. Tests: a later Python fixture must show the import line from a decoded string, including a non-ASCII encoding cookie that decodes cleanly. The release promise does not change in L0.
