# RepoScope

Local, read-only TypeScript and JavaScript architecture explorer. It turns supported source-level imports into an evidence-linked dependency graph so a developer can ask: **what depends on this file, and what evidence should I inspect before changing it?**

This repository is **in development**. The current contents are the planning pack: product contract, frozen versions, data schemas, fixtures, and bounded implementation prompts. There is not yet a working analyzer, local server, or investigation UI.

## Status

| Wave | Intent | State |
| --- | --- | --- |
| R0 | Freeze contracts, versions, and safety boundaries | In progress in this tree |
| R1–R5 | P0 engine, investigation UI, snapshot compare | Not started |
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

Application scripts (`npm ci`, `npm run build`, `npm run demo`) are R1/R7 deliverables. Today you need:

1. Node.js **24.21.0** (Active LTS, Krypton). This machine already has that exact build at `C:\Program Files\nodejs\node.exe`.
2. npm **11.19.0** (ships with that Node).
3. The documents in `docs/`, contracts in `contracts/`, and fixtures in `fixtures/`.

Pinned versions live in [`docs/versions.md`](docs/versions.md).

## Demonstration (after the engine exists)

The intended flagship path uses `fixtures/esm-baseline` and `fixtures/esm-revised`. It is specified in [`docs/blueprint/15-github-presentation.md`](docs/blueprint/15-github-presentation.md). Do not substitute hand-made screenshots for engine output.

## Credits

RepoScope will use the TypeScript compiler API, React Flow (`@xyflow/react`), Fastify, Vite, Vitest, and Playwright. The original contribution is the analysis model, evidence and coverage semantics, local safety boundary, investigation workflow, and verification — not those libraries.
