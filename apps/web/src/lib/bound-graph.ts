import type { AnalysisSnapshot, SemanticEdge } from "@reposcope/contracts";

export const GRAPH_NODE_CAP = 250;
export const GRAPH_EDGE_CAP = 500;

export interface BoundedGraph {
  nodeIds: string[];
  edges: SemanticEdge[];
  truncated: boolean;
}

function undirectedNeighbors(snapshot: AnalysisSnapshot): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const node of snapshot.nodes) {
    map.set(node.id, new Set());
  }
  for (const edge of snapshot.semanticEdges) {
    if (edge.targetId === undefined) {
      continue;
    }
    map.get(edge.importerId)?.add(edge.targetId);
    map.get(edge.targetId)?.add(edge.importerId);
  }
  return new Map([...map].map(([id, set]) => [id, [...set].sort()]));
}

export function boundGraph(
  snapshot: AnalysisSnapshot,
  focus?: string,
): BoundedGraph {
  const resolved = snapshot.semanticEdges.filter((edge) => edge.targetId !== undefined);
  if (snapshot.nodes.length <= GRAPH_NODE_CAP && resolved.length <= GRAPH_EDGE_CAP) {
    return {
      nodeIds: snapshot.nodes.map((node) => node.id),
      edges: resolved,
      truncated: false,
    };
  }
  const start = focus ?? snapshot.nodes[0]?.id;
  if (start === undefined) {
    return { nodeIds: [], edges: [], truncated: snapshot.nodes.length > 0 };
  }
  const neighbors = undirectedNeighbors(snapshot);
  const kept = new Set<string>([start]);
  const queue = [start];
  let head = 0;
  while (head < queue.length && kept.size < GRAPH_NODE_CAP) {
    const current = queue[head];
    head += 1;
    if (current === undefined) {
      break;
    }
    for (const next of neighbors.get(current) ?? []) {
      if (kept.has(next) || kept.size >= GRAPH_NODE_CAP) {
        continue;
      }
      kept.add(next);
      queue.push(next);
    }
  }
  const edges: SemanticEdge[] = [];
  for (const edge of resolved) {
    if (edge.targetId === undefined) {
      continue;
    }
    if (kept.has(edge.importerId) && kept.has(edge.targetId)) {
      edges.push(edge);
    }
    if (edges.length >= GRAPH_EDGE_CAP) {
      break;
    }
  }
  return {
    nodeIds: [...kept].sort(),
    edges,
    truncated: kept.size < snapshot.nodes.length || edges.length < resolved.length,
  };
}
