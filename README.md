# RepoScope

Local, read-only TypeScript and JavaScript architecture explorer. It turns supported source-level imports into an evidence-linked dependency graph so you can ask: **what depends on this file, and what evidence should I inspect before changing it?**

It reports **observed dependencies** and a **potential investigation scope**. It does not claim that a change will break N files, prove dead code, or predict runtime failures.

![Explorer showing reverse impact for src/lib/money.ts](reports/demo-explore.png)

## 90-second demo

1. `npm ci && npm run build && npm run demo`
2. Scan `fixtures/esm-baseline`.
3. Select `src/lib/money.ts`. Direct importer is `src/app.ts`. Shortest observed path: `src/main.ts → src/app.ts → src/lib/money.ts`.
4. Open the import statement and the content hash. Evidence is current, stale, or unavailable after a hash check.
5. Note the `app` / `cycle-a` / `cycle-b` cycle group. A cycle is an observed strongly connected set, not automatically a defect.
6. Compare with `fixtures/esm-revised`. The added observed dependency is `src/lib/money.ts → src/main.ts`.
7. Open `fixtures/unresolved-import` to see coverage for a specifier that is not resolved under this configuration.

```
npm ci
npm run verify
npm run demo
```

`GET /api/health` and other API routes require `Authorization: Bearer <token>`. The CLI passes the token in the URL fragment and does not print it.

## Setup

- Node.js **24.21.0** Active LTS and npm **11.19.0**
- `npm ci`
- `npm run build`
- `reposcope inspect [path]` or `npm run demo`

Pinned versions: [`docs/versions.md`](docs/versions.md).

## Commands

| Command | Purpose |
| --- | --- |
| `reposcope inspect [path] [--demo] [--port 8787]` | Loopback investigation UI |
| `reposcope scan [path] [--demo] [--out file] [--commit rev]` | Source-free snapshot JSON |
| `reposcope compare a.json b.json` | Structural snapshot diff |
| `npm run verify` | typecheck, lint, build, unit/integration, Playwright |

## What it does

- Scans a CLI-selected local root (read-only).
- Extracts static ESM imports and re-exports with `typescript@6.0.3` compiler-API resolution.
- Builds a file-level graph of observed dependencies. Arrow `A → B` means A imports B.
- Shows reverse impact, cycle groups, coverage omissions, and hash-checked evidence.
- Compares two source-free snapshots.
- Optional Git commit scans via `git ls-tree` / `git cat-file` (no checkout). JSON boundary policy evaluation.

## What it does not do

- Call a language model, embeddings API, or remote analysis service.
- Execute inspected project code or install that project's packages.
- Follow symlinks by default or accept filesystem paths from the browser.
- Treat type-only imports as value graph edges unless you opt in.

## Privacy

Bind is `127.0.0.1` only. Host and Origin are validated. Default exports omit source text and absolute paths. Private repositories are local-only; do not publish their snapshots.

## Credits

RepoScope uses the TypeScript compiler API, React Flow (`@xyflow/react`), Fastify, Vite, Vitest, and Playwright. The original contribution is the analysis model, evidence and coverage semantics, local safety boundary, investigation workflow, and verification.
