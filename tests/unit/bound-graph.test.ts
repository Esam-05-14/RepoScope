import { describe, expect, it } from "vitest";
import type { AnalysisSnapshot } from "@reposcope/contracts";
import { boundGraph, GRAPH_NODE_CAP } from "../../apps/web/src/lib/bound-graph.ts";

function snapshotWith(count: number): AnalysisSnapshot {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `f${index}.ts`,
    relativePath: `f${index}.ts`,
    contentHash: `sha256:${"a".repeat(64)}`,
    language: "ts" as const,
    projectContextId: "ctx:inferred",
    parseStatus: "ok" as const,
  }));
  const semanticEdges = nodes.slice(1).map((node, index) => ({
    key: `f${index}.ts>|internal:${node.id}|static-import|value`,
    importerId: `f${index}.ts`,
    targetId: node.id,
    edgeClass: "value" as const,
    syntaxClass: "static-import" as const,
    observationIds: [`obs:${index}`],
  }));
  return {
    schemaVersion: "1.0.0",
    engineVersion: "0.7.0-r7",
    parserVersion: "typescript@6.0.3",
    scope: {
      kind: "working-tree",
      repositoryIdentity: "repo:test",
      edgePolicy: "value-and-mixed",
      limits: { maxSourceFiles: 5000, maxBytesPerFile: 1, maxAnalyzedBytes: 1 },
    },
    nodes,
    observations: [],
    semanticEdges,
    coverage: {
      discoveredFiles: count,
      analyzedFiles: count,
      skippedFiles: 0,
      parseFailures: 0,
      constructCounts: {
        internal: count - 1,
        external: 0,
        unresolved: 0,
        unsupported: 0,
        typeOnly: 0,
        mixed: 0,
      },
      truncations: [],
    },
    graphDigest: `sha256:${"b".repeat(64)}`,
    contentManifestDigest: `sha256:${"c".repeat(64)}`,
  };
}

describe("bounded graph", () => {
  it("keeps small graphs intact and caps oversized ones", () => {
    const small = boundGraph(snapshotWith(3));
    expect(small.truncated).toBe(false);
    expect(small.nodeIds).toHaveLength(3);
    const large = boundGraph(snapshotWith(GRAPH_NODE_CAP + 40), "f0.ts");
    expect(large.truncated).toBe(true);
    expect(large.nodeIds.length).toBeLessThanOrEqual(GRAPH_NODE_CAP);
  });
});
