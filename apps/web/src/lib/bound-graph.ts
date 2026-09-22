import type { AnalysisSnapshot, SemanticEdge } from "@reposcope/contracts";
import { includedByPolicy, neighborhoodOf } from "@reposcope/graph";

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

export interface BoundGraphOptions {
  nodeCap?: number;
  edgeCap?: number;
  hops?: number;
  hideIsolated?: boolean;
}

export function boundGraph(
  snapshot: AnalysisSnapshot,
  focus?: string,
  options: BoundGraphOptions = {},
): BoundedGraph {
  const nodeCap = options.nodeCap ?? GRAPH_NODE_CAP;
  const edgeCap = options.edgeCap ?? GRAPH_EDGE_CAP;
  const resolved = snapshot.semanticEdges.filter(
    (edge) =>
      edge.targetId !== undefined &&
      includedByPolicy(edge.edgeClass, snapshot.scope.edgePolicy),
  );
  if (snapshot.nodes.length <= nodeCap && resolved.length <= edgeCap) {
    const all = new Set(snapshot.nodes.map((node) => node.id));
    const nodeIds =
      options.hideIsolated === true ? dropIsolated(all, resolved).sort() : [...all].sort();
    return {
      nodeIds,
      edges: resolved.filter(
        (edge) =>
          nodeIds.includes(edge.importerId) &&
          edge.targetId !== undefined &&
          nodeIds.includes(edge.targetId),
      ),
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
  while (head < queue.length && kept.size < nodeCap) {
    const current = queue[head];
    head += 1;
    if (current === undefined) {
      break;
    }
    for (const next of neighbors.get(current) ?? []) {
      if (kept.has(next) || kept.size >= nodeCap) {
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
    if (edges.length >= edgeCap) {
      break;
    }
  }
  const isolatedFiltered = options.hideIsolated === true ? dropIsolated(kept, edges) : [...kept];
  return {
    nodeIds: isolatedFiltered.sort(),
    edges: edges.filter(
      (edge) =>
        isolatedFiltered.includes(edge.importerId) &&
        edge.targetId !== undefined &&
        isolatedFiltered.includes(edge.targetId),
    ),
    truncated: kept.size < snapshot.nodes.length || edges.length < resolved.length,
  };
}

function dropIsolated(kept: Set<string>, edges: readonly SemanticEdge[]): string[] {
  const connected = new Set<string>();
  for (const edge of edges) {
    if (edge.targetId === undefined) {
      continue;
    }
    if (kept.has(edge.importerId) && kept.has(edge.targetId)) {
      connected.add(edge.importerId);
      connected.add(edge.targetId);
    }
  }
  return [...kept].filter((id) => connected.has(id));
}

export function boundNeighborhood(
  snapshot: AnalysisSnapshot,
  focus: string,
  options: BoundGraphOptions = {},
): BoundedGraph {
  const hops = options.hops ?? 2;
  const nodeCap = options.nodeCap ?? GRAPH_NODE_CAP;
  const edgeCap = options.edgeCap ?? GRAPH_EDGE_CAP;
  const nearby = neighborhoodOf(
    focus,
    snapshot.semanticEdges.map((edge) => ({
      importerId: edge.importerId,
      targetId: edge.targetId,
      edgeClass: edge.edgeClass,
    })),
    hops,
    snapshot.scope.edgePolicy,
  );
  const nodeIds = [...nearby].sort().slice(0, nodeCap);
  const kept = new Set(nodeIds);
  const edges: SemanticEdge[] = [];
  for (const edge of snapshot.semanticEdges) {
    if (edge.targetId === undefined || !includedByPolicy(edge.edgeClass, snapshot.scope.edgePolicy)) {
      continue;
    }
    if (kept.has(edge.importerId) && kept.has(edge.targetId)) {
      edges.push(edge);
    }
    if (edges.length >= edgeCap) {
      break;
    }
  }
  return {
    nodeIds,
    edges,
    truncated: nearby.size > nodeIds.length || edges.length >= edgeCap,
  };
}
