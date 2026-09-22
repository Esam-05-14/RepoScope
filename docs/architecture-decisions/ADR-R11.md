# ADR-R11: Java source plus declarative Maven

**Status:** Accepted (L0)

## Problem

Java imports name types, and those types land on disk only after a build tool chooses source roots. Running Maven or Gradle executes plugins. Opening jars in `~/.m2` reads outside the CLI root. Kotlin and Gradle DSLs are separate languages.

## Decision

A later `parser-java` records named `import` and `import static`. A `package` declaration is metadata, not an edge to every sibling. The same-package name with no import is not an observed dependency.

`pom.xml` inside the root is XML data: coordinates, module paths, and literal source roots. The default roots are `src/main/java` and `src/test/java`. `com.example.Foo` maps to `com/example/Foo.java` under one of those roots. A parent POM outside the root is `CONFIG_OUTSIDE_ROOT` and is not fetched. A named type with no file is unresolved. A name that is not in the reactor is external. Jars are not opened.

`import com.example.*` is `WILDCARD_IMPORT` and creates no file edge. `Class.forName`, service loaders, and annotation-processor discovery are unsupported when they appear as import-like syntax. They do not become inferred edges.

Gradle and Kotlin are not in the first Java wave. Groovy or Kotlin DSL evaluation would run project code. A later wave may decide whether string `include(...)` literals are worth a restricted scan. That decision is not permission to run Gradle.

## Alternatives

- Invoking Maven or Gradle to print the compile classpath: rejected. It executes the build.
- Reading the user Maven cache: rejected. It leaves the selected root.
- Treating Kotlin sources as Java: rejected. The grammar is a different language.

## Impact

Security: XML parsing disables external entities and keeps the manifest byte cap. No `mvn`, `gradle`, or `javac`. Compatibility: `.java` files stay out of inventory until the Java wave. Tests are the Maven reactor acceptance list in `docs/language-extension-plan.md`. The release promise does not name Java until that wave's browser gate passes.

ADR-R13 accepts the later Gradle `include("...")` scan and the Kotlin import extractor. This ADR's ban on running Gradle still holds. The Java resolver matches `.java` only.
