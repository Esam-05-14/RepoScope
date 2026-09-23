# R0 decision log

Wave R0 selects runtime, parser, schema, and confinement. It does not implement scanning, HTTP routes, or UI.

## Decisions made 20 September 2026

1. **Repository location.** `C:\Users\User\Documents\RepoScope` on branch `implementation`.
2. **Node 24.21.0.** Already installed locally. Pin CI to the same patch.
3. **Parser is `typescript@6.0.3`.** TypeScript 7.0 has no compiler API. Isolate all compiler use behind `packages/parser-ts` at R2.
4. **npm workspaces, one lockfile.** No pnpm or yarn.
5. **Local Node process + prebuilt browser UI.** ADR-R02. Not Electron.
6. **File-level graph first.** ADR-R03. No symbol graph in P0.
7. **Snapshots before Git.** ADR-R04. P0 compare is portable snapshot diff.
8. **No LLM in the trust path.** ADR-R05.
9. **Coverage is first-class.** ADR-R06.
10. **Schema `1.0.0` is frozen** in `contracts/schemas/`. Runtime validators are R1/R2 work; the JSON Schema is the contract they must implement.
11. **Vite 8.3.0 selected** with spike S1. Fallback is Vite 7 via a new ADR, not an unreviewed swap.

## R1 follow-up

Workspace packages and the loopback shell are implemented in wave R1. Parser extraction remains R2.

## Explicitly not decided at R0

- Packaged `reposcope inspect` CLI UX details beyond the command name (P1).
- Hosted public demo hosting vendor (only if later requested; public fixtures only).
- Maintainer security email (must be a real address before public release).

## Change control

A later agent may propose a deviation. It must not replace this stack to make a demo look complete. Update this log and add an ADR when a pin or boundary changes.

## L0 (22 September 2026)

ADR-R08 through ADR-R11 accept first-party Python and Java adapters, one UTF-16 evidence coordinate system, interpreter-free Python resolution, and declarative Maven. The schema document is `1.1.0`. TypeScript parser pin is unchanged.

## L1–L7 (22 September 2026)

`engineVersion` is `0.10.0-lang`. TypeScript-only snapshots still write schema `1.0.0` and `parserVersion` `typescript@6.0.3`. Snapshots that contain a `py`, `java`, or `kt` node write schema `1.1.0`. ADR-R12 pins bounded import scanners instead of starting an interpreter. ADR-R13 accepts a restricted Gradle `include` scan and a Kotlin import extractor. Gradle, Maven, and project Python are not executed.

## 0.11.0 (23 September 2026)

Product version and `engineVersion` are `0.11.0`. Parser pins are `py-import@2`, `java-import@2`, and `kt-import@2`. Gradle `srcDir` strings, Java imports of Kotlin files, literal `Class.forName` / `importlib.import_module`, Spring qualified class literals, and notebook code cells resolve inside the selected root. Gradle is still not executed. `@ComponentScan` package names stay wildcard omissions.
