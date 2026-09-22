# ADR-R10: Python resolution without an interpreter

**Status:** Accepted (L0)

## Problem

Python imports are resolved by an interpreter, `sys.path`, and executed packaging code. Running the inspected project, its `setup.py`, or its virtualenv would break confinement. Leaving every absolute import external would drop real in-repo edges.

## Decision

A later `parser-py` records `import` and `from … import` when the module name is a literal. Resolution is lexical:

- Relative imports walk parent packages using `__init__.py` directories.
- Absolute imports search inventoried files under roots declared in `pyproject.toml` and `setup.cfg`, then a `src/` layout, then the project root. That order is part of the context digest.
- A match is `pkg/mod.py` or `pkg/mod/__init__.py`.
- Any other static name is an external package. Site-packages outside the root are not read.
- An import nested in `TYPE_CHECKING` is a type-class edge and stays off the default value graph.
- `from module import *` is `WILDCARD_IMPORT` and creates no file edge.
- `importlib` and other non-literal module expressions are unsupported syntax.
- `setup.py` is not executed. If it is the only layout declaration, the import is not resolved under this configuration.

The parser pin is a grammar that does not start Python. If that spike fails on Windows, the fallback is a new ADR, not a silent `python -c`.

## Alternatives

- Shelling out to the project interpreter: rejected. It executes project code and depends on whichever Python is installed.
- Treating every absolute import as external: rejected. It hides in-repo package edges the developer is there to inspect.
- Expanding star imports to every file in the package: rejected. Those edges were not declared.

## Impact

Security: no pip, Poetry, conda, or project Python. Manifests are size-capped data. Compatibility: Python files stay out of inventory until the Python wave. Tests for that wave are the acceptance list in `docs/language-extension-plan.md`. The release promise does not name Python until that wave's browser gate passes.

ADR-R12 records the parser pin that landed: a bounded import scanner, `py-import@1`, with no Python process.
