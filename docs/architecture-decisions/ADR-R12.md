# ADR-R12: Bounded import scanners

**Status:** Accepted (L2)

## Problem

ADR-R10 prefers a pinned grammar that does not start Python. A tree-sitter WASM spike was not taken for this wave. Falling through to `python -c`, `mvn`, or `javac` would execute project code or leave the selected root.

## Decision

`parser-py`, `parser-java`, and `parser-kt` are bounded scanners. They record literal `import` / `from` syntax and stop. Versions are `py-import@1`, `java-import@1`, and `kt-import@1`. A TypeScript-only snapshot keeps `parserVersion` `typescript@6.0.3`. A snapshot that contains another language appends those pins. The reuse key compares that string, so a parser bump cannot reuse old resolutions.

The scanners do not start an interpreter, a compiler, or a build tool. `pyproject.toml` and `setup.cfg` are read as data for source roots. `pom.xml` is a small XML subset: predefined entities only, `DOCTYPE` and `ENTITY` rejected, 256 KiB cap.

## Alternatives

- tree-sitter WASM: still allowed later. It would be a new parser version, not a silent replacement.
- Shelling out to Python or Java: rejected. It executes the inspected project.

## Impact

Security: no project process and no XML external entities. Compatibility: `fixtures/esm-baseline` keeps its graph digest. Tests cover relative Python imports, `src/` layout, `TYPE_CHECKING`, star imports, `setup.py` not running, Maven reactor edges, wildcard omissions, and a parent POM outside the root.
