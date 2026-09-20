# 15 GitHub presentation

Write the public README only after P0 works. Lead with the problem, a real screenshot of engine output, a 90-second demo, and setup. Then pipeline, supported syntax, coverage, privacy.

## Demo script (after the engine exists)

1. Analyze `fixtures/esm-baseline` for real.
2. Select `src/lib/money.ts`; show direct importer `src/app.ts` and path `src/main.ts → src/app.ts → src/lib/money.ts`.
3. Open the import statement and the source hash.
4. Show the `app` / `cycle-a` / `cycle-b` cycle and that a cycle is not automatically a bug.
5. Compare baseline vs revised; the new edge is `src/lib/money.ts → src/main.ts`.
6. Open `fixtures/unresolved-import` and the coverage warning.
7. End on the test command and published limitations.

## CV language (only after verification)

"Built RepoScope, a local TypeScript/JavaScript architecture explorer with configuration-aware import analysis, evidence-linked dependency graphs, cycle detection, and structural snapshot comparison."

Until then: project in development.
