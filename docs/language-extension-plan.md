# Python and Java extension plan

Status: **L1–L7 accepted.** Engine dispatch keeps the `fixtures/esm-baseline` graph digest. Python, Java, and Kotlin imports are first-party adapters. L6 reads `include("...")` strings from `settings.gradle` and `settings.gradle.kts` and does not run Gradle. L7 is a bounded Kotlin import extractor (`parser-kt`); the Java resolver still matches `.java` only. Writers emit schema `1.1.0` when a snapshot contains a `py`, `java`, or `kt` node, and `1.0.0` otherwise. See ADR-R12 and ADR-R13.

RepoScope today (`0.9.2-view`) is a local, read-only TypeScript and JavaScript file graph. `A → B` means file A declares a supported dependency on B. The central question stays: what depends on this file, and which evidence should be inspected before changing it. That answer is a traversal of observed dependencies. It is not a runtime forecast.

Blueprint P2 already names “more languages.” Blueprint exclusions still apply: no source execution, no package install in the inspected project, no generic plugin system, no symbol graph (ADR-R03), no LLM in the trust path (ADR-R05).

## What this plan changes, and what it refuses

| In the first languages | Deferred |
| --- | --- |
| Python `import` / `from … import` with a static module name | Executing `setup.py`, Poetry, pip, conda, or the project interpreter |
| `TYPE_CHECKING` as a type-class edge, omitted from the default value graph | mypy, pyright, or importlib runtime hooks as the resolver |
| Package layout from `pyproject.toml` and `setup.cfg` read as data | Jupyter notebooks, `.pyc`, namespace inventiveness beyond recorded omissions |
| Java `import` and `import static` of a named type | Kotlin, Scala, Groovy, Android resources |
| Maven `pom.xml` read as XML: modules, coordinates, source roots | Running Maven, Gradle, or `javac` |
| Same snapshot, same lenses (Your code / Libraries), same evidence rules | Cross-language edges, Spring beans, reflection, `Class.forName` |

A mixed repository stays one snapshot. Each node carries its language. An edge exists only when that language’s resolver maps a supported specifier onto an inventoried file. A TypeScript file that mentions a Python module is not an observed file edge.

## Product improvements that have to land first

These are not language features. They keep TypeScript digests stable and stop the engine from growing a second scanner.

1. **Language dispatch inside the engine, not a plugin loader.** `packages/engine` chooses a first-party adapter by extension. Adapters are ordinary workspace packages. `contracts` still has no parser, filesystem, or compiler dependency. Unknown extensions stay out of inventory, as they do now.
2. **Incremental reuse includes `parserVersion`.** A parser bump must not reuse a prior resolution. The current content-hash reuse key is necessary and not sufficient once a second parser exists.
3. **Project context becomes language-neutral.** Today a context is a tsconfig. A context record gains `language` and keeps `configPath` relative. Python contexts come from `pyproject.toml` / `setup.cfg`. Java contexts come from `pom.xml`. Config outside the root stays `CONFIG_OUTSIDE_ROOT`.
4. **Skip directories for ecosystems we will not execute.** Add `__pycache__`, `.venv`, `venv`, `.tox`, `.mypy_cache`, `.pytest_cache`, `target`, `.gradle` to the existing skip list when the matching wave starts. Do not read `~/.m2` or Gradle caches. They sit outside the CLI root.
5. **Coverage stays first-class (ADR-R06).** Every new syntax either becomes a supported observation or a classified omission with a reason code. A partial Python graph must not look like a complete one.
6. **Graph and brief lenses stay.** Your code is the file graph a developer reads first. Libraries is the specifier catalog. New languages add a language filter on the graph. They do not add a third product.
7. **Evidence coordinates stay one system.** Decode source to a JavaScript string and keep zero-based UTF-16 offsets (current contract). Python encoding cookies and Java charset declarations are decode steps. Undecodable bytes are `ENCODING_UNSUPPORTED`. This needs ADR-R09 before parsers land.
8. **XML and TOML are data.** Cap manifest bytes (same order as `package.json`, 256 KiB). XML parsing disables external entities. TOML is parsed as data. Neither file is imported or evaluated.

TypeScript graph digests for existing fixtures are a stop gate on the dispatch wave. If `fixtures/esm-baseline` changes digest, the wave fails.

## Decisions

Accepted at L0. The ADR files are the binding text.

**ADR-R08 — first-party language adapters.** No plugin API, no user-supplied parsers, no dynamic `import()` of repository code. `parser-ts` stays on `typescript@6.0.3`. `parser-py` and `parser-java` are new packages that must not import application code.

**ADR-R09 — one evidence coordinate system.** UTF-16 offsets after a successful decode, for every language.

**ADR-R10 — Python resolution without an interpreter.** Resolution is lexical package layout plus declarative project metadata. The inspected project’s Python is not started.

**ADR-R11 — Java is source plus declarative Maven.** Named-type imports resolve through source roots inside the root. Gradle and Kotlin wait for their own gates. Build files are not executed.

**Schema.** Current schema is `1.0.0` with `additionalProperties: false`. Adding `py` and `java` to `LanguageId` is a minor bump to `1.1.0`, still major `1`. Readers keep accepting `1.x`. Writers emit `1.1.0` only once a non-TypeScript node exists. Old snapshots remain valid. Unknown majors stay rejected.

## Shared observation model

Reuse the existing split: an observation is one source statement; a semantic edge exists only when the target is an inventoried file and the edge class is included by policy.

| Concept | TypeScript today | Python | Java |
| --- | --- | --- | --- |
| Value edge | static import, export-from, string `require` | `import` / `from` outside `TYPE_CHECKING` | named `import`, `import static` |
| Type-class edge, omitted by default | `import type`, type-only re-export | import nested in `TYPE_CHECKING` | none in the first Java slice |
| External | npm name, `node:` / `bun:` | top-level module not in inventory | package not in a reactor source root |
| Unresolved | specifier not resolved under this configuration | relative package with no matching file | named type with no matching `.java` |
| Unsupported | `import()`, assets, protocols | `importlib`, non-literal module, star import | wildcard import, `Class.forName`, annotation-processor discovery |
| Component | directory or workspace package prefix | distribution directory from declarative metadata, else package directory | Maven module directory, else source-root package prefix |

Star imports (`from pkg import *`) and Java wildcard imports (`import com.foo.*`) are visible omissions. They do not fan out into every file in the package. That fan-out would be an invented edge.

Binding names, when the syntax names them, stay declared names. They are not usage proof. Python `import x as y` records `y` as a declared name and resolves `x`. Java static imports record the member name and resolve the type’s file, not the member.

## Python slice

### Supported syntax

- `import a`, `import a.b`, `import a.b as c`
- `from a.b import c`, `from . import c`, `from ..pkg import c`
- Parenthesized name lists
- `TYPE_CHECKING` blocks as type-class observations

### Resolution

1. Relative imports walk parent packages using `__init__.py` directories. A missing target is `UNRESOLVED_MODULE`, not a guess.
2. Absolute imports search inventoried files under declarative roots, in order: `pyproject.toml` `[tool.setuptools.packages.find]` / `package-dir`, then `setup.cfg` `package_dir`, then a `src/` layout if present, then the project root. First inventoried match wins. The search order is part of the context digest.
3. A match is `pkg/mod.py` or `pkg/mod/__init__.py`.
4. Anything else with a static name is `external` (`EXTERNAL_PACKAGE`). RepoScope does not install it and does not read site-packages outside the root.
5. `setup.py` is not executed. If it is the only place a layout is declared, coverage says the layout is not resolved under this configuration.

### Omissions

- `importlib.import_module`, `__import__`, and any non-literal module expression: `UNSUPPORTED_SYNTAX`, unless a later opt-in copies the string-`import()` policy. A string is still not runtime proof.
- `from module import *`: `WILDCARD_IMPORT` (new reason code), no file edge.
- Encoding cookie that we cannot decode: `ENCODING_UNSUPPORTED`.

### Parser pin

Prefer a pinned grammar that does not start Python: `tree-sitter` with a WASM grammar, version recorded as `parserVersion`. Do not shell out to the inspected environment. If the WASM spike fails on Windows, the fallback is an ADR, not a silent switch to `python -c`.

### Fixtures and acceptance

- relative import hits the expected file and line
- `src/` layout absolute import hits the package file
- missing module stays unresolved and visible
- `TYPE_CHECKING` cycle does not appear in the default value graph
- star import is an omission, not a fan-out
- a `setup.py` that would create a marker file if executed does not create it
- identical inputs produce an identical `graphDigest`
- snapshot has no absolute paths and no source text by default

## Java slice

### Supported syntax

- `package` is metadata, not an edge to every sibling
- `import com.example.Foo;`
- `import static com.example.Foo.bar;` and `import static com.example.Foo.bar;`
- The same-package reference with no import statement is not an observed dependency. Same-package use is not an import.

### Resolution

1. Read `pom.xml` as XML inside the root. Record `groupId`, `artifactId`, `modules`, and `sourceDirectory` / `testSourceDirectory` when they are literal paths. Default source root is `src/main/java`. Default test root is `src/test/java`.
2. Map `com.example.Foo` to `com/example/Foo.java` under a source root of a reactor module.
3. A parent POM outside the root is `CONFIG_OUTSIDE_ROOT`. Do not fetch it.
4. A named type with no file is unresolved. A name that looks like a third-party package and is not in the reactor is external. Do not open jars.
5. Test sources are files with role `test`, same as today’s test filter. They stay in the snapshot. The Your-code graph can hide them.

### Omissions

- `import com.example.*;` → `WILDCARD_IMPORT`, no file edge
- `Class.forName`, `ServiceLoader`, reflection, annotation processors, Spring component scan → `UNSUPPORTED_SYNTAX` when the syntax is an import-like construct we detect; otherwise they are out of scope, not silent edges
- `module-info.java` `requires` → external module name, not a file edge, until a later wave maps modules to directories

### Gradle and Kotlin

Not in the first Java wave. Groovy and Kotlin DSL evaluation would execute project code. A later wave may read string literals in `settings.gradle` and `settings.gradle.kts` (`include("…")`) with a restricted scan, still without running Gradle. Kotlin `.kt` files are their own language wave.

### Fixtures and acceptance

- Maven reactor module A imports a type defined in module B and the edge target is that `.java` file
- unresolved type stays visible
- wildcard import is an omission
- a `pom.xml` that references a plugin does not cause a plugin to run
- parent POM outside the root does not get fetched
- digest stability and source-free export match the TypeScript gates

## Waves

Stop at each gate. A failed security or data-correctness gate blocks the next wave. Do not fake parser output with fixture JSON.

| Wave | Build | Stop evidence |
| --- | --- | --- |
| L0 | ADR-R08–R11, schema `1.1.0` draft, reason code `WILDCARD_IMPORT`, versions note. No parser. | Review only. TypeScript fixtures unchanged. |
| L1 | Engine dispatch. TypeScript adapter wraps `parser-ts`. Reuse key includes parser version. Skip-dir list unchanged until L2. | `esm-baseline` graph digest unchanged. Existing unit tests pass. |
| L2 | `parser-py` extract and resolve. Python fixtures. Context from TOML/CFG. | Python acceptance list above. No Python process. No out-of-root read. |
| L3 | Python in Your code / Libraries, component rollup, brief claims, coverage omissions, graph language filter. | Browser pass on a Python fixture: select a module, see importer, open evidence. |
| L4 | `parser-java` plus Maven XML. Java fixtures. | Java acceptance list above. No Maven process. XML entity expansion capped. |
| L5 | Java in the same lenses and component rollup (module prefix). | Browser pass on the Maven reactor fixture. |
| L6 | Decision only: Gradle string `include`, or stop. | ADR. No Gradle execution either way. |
| L7 | Kotlin only if L6 says the source grammar is worth a package. | Separate acceptance list. Not implied by “Java ecosystem.” |

## Security and confinement

- CLI still chooses the root once. Routes still take opaque ids.
- Adapters use the injected filesystem host. They do not get a raw `fs` path from the browser.
- No `pip`, `poetry`, `uv`, `mvn`, `gradle`, `javac`, or project `python` invocation.
- No symlink follow.
- Manifest and source byte caps stay enforced. Observations per file stay capped.
- Dependency files (`requirements.txt`, `pom.xml` dependencies) may feed the Libraries catalog as declared names. They are not installed, not resolved as internals, and not vulnerability findings.

## Release promise

README, `docs/versions.md`, and the product sentence change only after L3 (Python) or L5 (Java) passes. Until then the product remains a TypeScript and JavaScript explorer that can ignore other files.

Suggested sentence, after both gates:

> RepoScope reports observed source-level dependencies in TypeScript, JavaScript, Python, and Java. A Python or Java edge is a declared import resolved under the selected project configuration. It is not a runtime import and not a symbol-level use.

## Explicitly out of scope

Symbol and call graphs. Dead code. Test-impact guarantees. Cross-language edges. Notebooks. Binary artifacts. Dependency vulnerability databases. Running formatters, type checkers, or build tools. A plugin SDK.
