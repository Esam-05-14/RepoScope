# Frozen versions (R0)

Recorded 20 September 2026. These are selected pins, not proof that the application has been installed. R1 installs this exact set and verifies parse plus alias resolution before any UI work.

## Runtime (verified on this machine)

| Item | Pin | Evidence |
| --- | --- | --- |
| Node.js | **24.21.0** Active LTS (Krypton) | `C:\Program Files\nodejs\node.exe` printed `v24.21.0` |
| npm | **11.19.0** | same install printed `11.19.0` |
| engines.node | `>=24.21.0 <25` | reject Node 26 Current and Node 22 Maintenance for first-party code |
| engines.npm | `>=11.19.0 <12` | one package manager; one lockfile |
| CI Linux | Node **24.21.0** | same major/minor/patch as Windows |

Node 26 is Current and becomes LTS on 28 October 2026. Do not jump to it during P0. Node 22 remains Maintenance LTS until 30 April 2027 and is a documented fallback only if a dependency cannot run on 24.

## Parser (binding)

| Item | Pin | Why |
| --- | --- | --- |
| `typescript` (compiler API) | **6.0.3** | Last JavaScript compiler-API line below major 7. `createSourceFile`, config parse, and `resolveModuleName` live here. |
| TypeScript 7.x (`typescript@7`, `@typescript/native`) | **forbidden as parser** | TypeScript 7.0 ships no programmatic API. A later 7.1 API is a different contract. |
| `@typescript/typescript6` | not used | Compatibility shim for repos that also need `tsc` 7. RepoScope uses 6.0.3 directly. |

The inspected project may use a different TypeScript version. Record analyzer version and selected config. Unknown compiler options or syntax become visible diagnostics, not a hidden fallback presented as exact compatibility.

## Application stack (to install at R1)

| Area | Package | Pin | Notes |
| --- | --- | --- | --- |
| Local API | `fastify` | **5.12.5** | Schema-validated routes; loopback only |
| UI | `react` / `react-dom` | **19.3.0** | Investigation UI only |
| Bundler | `vite` | **8.3.0** | Rolldown-based; spike S1 |
| React plugin | `@vitejs/plugin-react` | **6.1.1** | Peer is `vite@^8.0.0` |
| Graph view | `@xyflow/react` | **12.11.6** | Bound visible complexity |
| Unit/integration | `vitest` | **5.0.1** | Peers include `vite@^6 \|\| ^7 \|\| ^8` |
| Browser tests | `playwright` / `@playwright/test` | **1.63.0** | Isolated contexts |
| Node types | `@types/node` | **24.13.3** | Match Node 24, not `@types/node@26` |

If spike S1 fails on Windows, the documented fallback is Vite 7 plus a Vite-7-compatible React plugin. That fallback is a recorded ADR change, not a silent downgrade.

## Schema and engine metadata

| Field | R0 value |
| --- | --- |
| Snapshot `schemaVersion` | `1.0.0` |
| Snapshot major compatibility | accept `1.x.x`; reject unknown majors |
| `engineVersion` | `0.7.0-r7` |
| `parserVersion` | `typescript@6.0.3` |

## Sources checked

- https://nodejs.org/en/about/previous-releases
- https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- npm registry: `typescript@6.0.3`, `fastify@5.12.5`, `react@19.3.0`, `vite@8.3.0`, `@vitejs/plugin-react@6.1.1`, `@xyflow/react@12.11.6`, `vitest@5.0.1`, `playwright@1.63.0`
