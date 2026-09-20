# Contracts

Specification artifacts. They are not proof that runtime validation exists.

| File | Role |
| --- | --- |
| `schemas/analysis-snapshot.schema.json` | Portable analysis document |
| `schemas/comparison.schema.json` | Structural diff of two snapshots |
| `schemas/api-error.schema.json` | Stable API errors |
| `examples/analysis-snapshot.example.json` | Illustrative baseline-shaped payload |
| `examples/comparison.example.json` | Illustrative baseline vs revised diff |

Implement Ajv (or Fastify's schema compiler) against these files at R1/R2. Do not drift field names in TypeScript types without updating the schema first.

`packages/contracts` at R1 should re-export types generated from or kept in lockstep with these schemas. That package must not import React, Fastify, `fs`, or `typescript`.
