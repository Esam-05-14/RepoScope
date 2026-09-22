# ADR-R13: Gradle include strings and Kotlin imports

**Status:** Accepted (L6, L7)

## Problem

ADR-R11 left Gradle and Kotlin for a later decision. Evaluating `settings.gradle` or a Kotlin DSL would run project code. Ignoring `include("...")` drops reactor modules that have no `pom.xml`. Treating `.kt` files as Java would invent a grammar the Java resolver does not have.

## Decision

L6 reads `settings.gradle` and `settings.gradle.kts` for `include("...")` and `include('...')` string literals only. A path is a directory inside the root. Bare names and comments are ignored. Gradle is not started.

L7 adds `parser-kt`. It records `import foo.Bar`, `import foo.Bar as Baz`, and `import foo.*`. A Kotlin import may resolve to `.kt` or `.java` under `src/main/kotlin`, `src/test/kotlin`, and the module's Java source roots. The Java resolver still matches `.java` only, so a Java import of a Kotlin type stays unresolved. `import foo.*` is `WILDCARD_IMPORT` and does not fan out.

## Alternatives

- Running Gradle to list projects: rejected. It executes the build.
- Resolving Kotlin types from Java files: rejected. That would change the Java acceptance list and pretend a Java import named a Kotlin file.

## Impact

Security: no Gradle process and no Gradle cache reads. Compatibility: included directories become source roots for the Java and Kotlin resolvers. The release promise names Kotlin imports as declared source imports, not a symbol graph.
