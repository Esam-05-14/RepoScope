import { createHash } from "node:crypto";
import {
  semanticEdgeKey,
  targetKeyForEdge,
  type AnalysisSnapshot,
  type EdgePolicy,
  type FileNode,
  type SemanticEdge,
} from "@reposcope/contracts";

export function sha256Json(value: unknown): string {
  const json = JSON.stringify(value);
  return `sha256:${createHash("sha256").update(json, "utf8").digest("hex")}`;
}

function includedByPolicy(edge: SemanticEdge, policy: EdgePolicy): boolean {
  if (edge.targetId === undefined) {
    return false;
  }
  if (policy === "include-type-only") {
    return true;
  }
  return edge.edgeClass === "value" || edge.edgeClass === "mixed";
}

export function graphDigestOf(
  nodes: readonly FileNode[],
  edges: readonly SemanticEdge[],
  policy: EdgePolicy,
): string {
  const nodeIds = [...nodes.map((node) => node.id)].sort();
  const normalized = edges
    .filter((edge) => includedByPolicy(edge, policy))
    .map((edge) => ({
      key: semanticEdgeKey({
        importerId: edge.importerId,
        targetKey: targetKeyForEdge(edge),
        syntaxClass: edge.syntaxClass,
        edgeClass: edge.edgeClass,
      }),
      importerId: edge.importerId,
      targetKey: targetKeyForEdge(edge),
      edgeClass: edge.edgeClass,
      syntaxClass: edge.syntaxClass,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  return sha256Json({ nodes: nodeIds, edges: normalized });
}

export function contentManifestDigestOf(nodes: readonly FileNode[]): string {
  const files = [...nodes]
    .map((node) => ({ path: node.relativePath, hash: node.contentHash }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  return sha256Json({ files });
}

export function digestSnapshot(snapshot: AnalysisSnapshot): AnalysisSnapshot {
  return {
    ...snapshot,
    graphDigest: graphDigestOf(
      snapshot.nodes,
      snapshot.semanticEdges,
      snapshot.scope.edgePolicy,
    ),
    contentManifestDigest: contentManifestDigestOf(snapshot.nodes),
  };
}
