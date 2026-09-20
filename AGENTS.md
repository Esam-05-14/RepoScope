# Agent instructions

RepoScope is a deterministic local analyzer. Cursor may help author it. The finished product is not an AI wrapper.

## Binding documents

Read, in order, before changing behavior:

1. `docs/r0-decision-log.md`
2. `docs/versions.md`
3. `docs/confinement-contract.md`
4. `contracts/schemas/analysis-snapshot.schema.json`
5. The wave prompt in `prompts/` that matches the current wave

The source blueprint is `docs/blueprint/`. A proposed deviation must state the problem, alternatives, security or compatibility impact, affected tests, and whether the release promise changes. Do not silently broaden scope or weaken a gate.

## Product language

Use: observed dependency, potential investigation scope, declared value import, not resolved under this configuration.

Do not use: this change will break N files, complete architecture, dead code proven, safe to delete.

A source-level import is not runtime execution or symbol-level usage.

## Implementation rules

- Build and verify one wave at a time. Stop at the wave gate.
- No application feature work in R0. R1 creates the workspace and loopback shell.
- Packages must not import application code. `contracts` has no React, Fastify, filesystem, or TypeScript compiler dependency. `graph` receives plain records, not ASTs. `parser-ts` uses an injected filesystem host.
- Pin `typescript@6.0.3` for the compiler API. Do not install TypeScript 7 as the parser. TypeScript 7.0 has no programmatic API.
- The CLI chooses the repository root once. The browser API accepts opaque IDs only.
- Default snapshots are source-free and must not contain absolute paths.
- Do not install packages inside an inspected project. Do not evaluate its JavaScript config or run its scripts.
- Do not scan or publish Tripwire or other private repositories in `reports/`.
- Do not commit or push unless the user explicitly asks. Never force-push.

## Terminology for graph edges

Store `A -> B` when file A declares a supported dependency on B. "Imports" is forward. "Imported by" is reverse. Reversing an arrow without changing its label is a correctness defect.
