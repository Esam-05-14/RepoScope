# ADR-R01: TypeScript compiler adapter

**Status:** Accepted (R0)

Use the TypeScript 6 compiler API behind `packages/parser-ts` rather than Tree-sitter for initial scope. The compiler API also gives configuration-aware resolution (`readConfigFile`, `parseJsonConfigFileContent`, `resolveModuleName`).

This is a scope decision, not a claim that Tree-sitter is inferior. Keep the extract/resolve interface replaceable.

Pin: `typescript@6.0.3`. TypeScript 7.0 has no programmatic API.
