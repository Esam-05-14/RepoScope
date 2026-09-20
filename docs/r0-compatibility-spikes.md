# R0 compatibility spikes

Specify now. Execute at the start of R1 (versions + parse) and R2 (resolution). Do not treat a spike as an application feature.

## S1 — Vite 8 + plugin-react 6 + Vitest 5 on Windows

**Question.** Does `vite@8.3.0` + `@vitejs/plugin-react@6.1.1` + `vitest@5.0.1` install, typecheck, and run a trivial React render test on Windows and in Linux CI?

**Pass.** `npm ci` (after R1 lockfile) succeeds; `vitest` runs one dummy test; Vite builds an empty app shell.

**Fail.** Record errors. Switch to Vite 7 and a matching React plugin through a new ADR. Do not mix Vite 8 with a Vite 7 plugin.

## S2 — TypeScript 6.0.3 parse and resolve

**Question.** With `typescript@6.0.3`, do `ts.createSourceFile`, `ts.parseJsonConfigFileContent` / `ts.readConfigFile`, and `ts.resolveModuleName` exist and behave as the wiki examples for 6.x?

**Inputs.** `fixtures/esm-baseline` plus a tiny alias fixture created during the spike (not a product feature).

**Pass.** Relative `./app.js` → `src/app.ts`. A `paths` alias resolves through the compiler, not a hand-rolled search.

**Fail.** Stop R2. Do not invent an extension-search algorithm.

## S3 — Inspected project TypeScript ≠ analyzer TypeScript

**Question.** A fixture whose `tsconfig` would be invalid or differently interpreted under TS 7 still produces a labeled diagnostic under 6.0.3 instead of a silent fallback.

**Pass.** Diagnostic is visible on coverage. Graph is not claimed to match the project's own `tsc`.

## S4 — Node 24 worker + cancellation

**Question.** `worker_threads` on Node 24.21.0 can receive a cancel message and stop a busy loop without leaving the parent process bound to a completed-looking scan.

**Pass.** A canceled task cannot be read back as `status: completed`.

**When.** R1 session/worker protocol. Not an R0 code drop.

## S5 — Case-preserving paths on Windows

**Question.** Two inventory files that differ only by case are detected as a collision, not silently merged by lowercasing.

**Pass.** Diagnostic + coverage state. Node identities keep original case with forward slashes.

## Stop rule

If S2 fails, parser work stops. If S1 fails, UI bundling stops until the fallback ADR is written. Do not proceed into explorer UI (R4) on an unverified parser.
