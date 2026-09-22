# ADR-R08: First-party language adapters

**Status:** Accepted (L0)

## Problem

Python and Java need their own extractors. A plugin host would let an inspected repository supply code that RepoScope then loads. The blueprint forbids a generic plugin system, and the confinement contract forbids importing or running inspected project configuration.

## Decision

`packages/engine` will dispatch by file extension to first-party adapters. `parser-ts` stays the TypeScript and JavaScript adapter and stays pinned to `typescript@6.0.3`. `parser-py` and `parser-java` are later workspace packages. They must not import application code. `contracts` takes no parser, filesystem, or compiler dependency. There is no user-supplied parser and no dynamic import of the inspected tree.

L0 adds the language ids `py` and `java` and the optional project-context field `language` (`typescript`, `python`, `java`). Writers keep emitting snapshot `schemaVersion` `1.0.0` until a snapshot contains a non-TypeScript node. The schema document id is `1.1.0`. Readers still accept every `1.x` snapshot.

## Alternatives

- A plugin API with entry points in the inspected repo: rejected. It is a plugin system and an execution path.
- One parser package that imports tree-sitter and the TypeScript compiler together: rejected. `contracts` and `parser-ts` would pick up unrelated native or grammar dependencies.
- Inventing cross-language edges: rejected. An edge exists only when that language's resolver maps a supported specifier onto an inventoried file.

## Impact

Security: adapters will use the injected filesystem host. The browser still never sends a path. Compatibility: existing `1.0.0` snapshots stay valid; `additionalProperties` remains false, so new fields are optional and listed. Tests: TypeScript fixture digests must not change in L0, because no scanner behavior changes. The release promise stays TypeScript and JavaScript until the Python and Java browser gates pass.
