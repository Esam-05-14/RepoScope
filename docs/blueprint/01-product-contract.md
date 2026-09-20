# 01 Product contract

RepoScope is a local, read-only TypeScript and JavaScript architecture explorer that turns supported source-level imports into an evidence-linked dependency graph, then helps a developer investigate change impact and compare structural snapshots.

Central question: **What depends on this file, and what evidence should I inspect before changing it?** The answer is a graph traversal over observed dependencies, not an AI prediction and not proof that a runtime failure will occur.

## Software, not an AI wrapper

No language model, API key, embeddings, vector database, or model subscription is required.

## Flagship demonstration

Open `fixtures/esm-baseline`. Select `src/lib/money.ts`. Display its direct importer and the transitive importer path from `src/main.ts`. Click each edge to open its exact import statement. Switch to `fixtures/esm-revised` and show the newly introduced cycle that includes the helper. Finish at Coverage with `fixtures/unresolved-import`.

## Required language

Use "observed dependency", "potential investigation scope", "declared value import", and "not resolved under this configuration".
