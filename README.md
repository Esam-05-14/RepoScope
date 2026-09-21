# RepoScope

Local, read-only TypeScript and JavaScript architecture explorer. It turns supported source-level imports into an evidence-linked dependency graph so a developer can ask: **what depends on this file, and what evidence should I inspect before changing it?**

This repository is **in development**. R1 provides workspaces, an authenticated loopback shell, and a prebuilt UI placeholder. There is not yet a working scanner, graph, or evidence inspector.

## Status

| Wave | Intent | State |
| --- | --- | --- |
| R0 | Freeze contracts, versions, and safety boundaries | Done |
| R1 | Workspaces, CLI, authenticated loopback health | Done |
| R2 | Confined inventory, parser, observations, coverage | Done |
| R3–R5 | Graph algorithms, investigation UI, snapshot compare | Not started |
| R6 | Optional P1 Git adapter and boundary policy | Deferred until P0 gates pass |
| R7 | Packaging, benchmarks, public docs | Not started |

Do not describe RepoScope as completed software until the P0 release gate in `docs/waves.md` passes.

## What it will do

- Scan a CLI-selected local repository (read-only).
- Extract static ESM imports and re-exports with TypeScript compiler-API resolution.
- Build a file-level graph of **observed dependencies**, not runtime proof.
- Show reverse impact, cycle groups, coverage omissions, and source evidence.
- Compare two source-free structural snapshots.

## What it will not do

- Call a language model, embeddings API, or remote analysis service.
- Execute inspected project code or install that project's packages.
- Claim a change "will break N files", prove dead code, or guarantee test impact.
- Expose a public server over a user's filesystem.

## Local setup

1. Node.js **24.21.0** (Active LTS) and npm **11.19.0**.
2. `npm ci`
3. `npm run build`
4. `npm run demo` — serves `fixtures/esm-baseline` on `127.0.0.1`. The session token is passed in the URL fragment and is not printed.

`GET /api/health` requires `Authorization: Bearer <token>`. There is no repository scan yet.

Pinned versions live in [`docs/versions.md`](docs/versions.md).

## Demonstration (after the engine exists)

The intended flagship path uses `fixtures/esm-baseline` and `fixtures/esm-revised`. It is specified in [`docs/blueprint/15-github-presentation.md`](docs/blueprint/15-github-presentation.md). Do not substitute hand-made screenshots for engine output.

## Credits

RepoScope will use the TypeScript compiler API, React Flow (`@xyflow/react`), Fastify, Vite, Vitest, and Playwright. The original contribution is the analysis model, evidence and coverage semantics, local safety boundary, investigation workflow, and verification — not those libraries.
