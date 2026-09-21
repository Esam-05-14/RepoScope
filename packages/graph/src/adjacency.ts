export type NodeId = string;
export type Adjacency = ReadonlyMap<NodeId, readonly NodeId[]>;

export type EdgeClass = "value" | "type" | "mixed";
export type EdgePolicy = "value-and-mixed" | "include-type-only";

export interface DirectedEdge {
  from: NodeId;
  to: NodeId;
  edgeClass: EdgeClass;
}

export function emptyAdjacency(): Adjacency {
  return new Map();
}

export function includedByPolicy(
  edgeClass: EdgeClass,
  policy: EdgePolicy,
): boolean {
  if (policy === "include-type-only") {
    return true;
  }
  return edgeClass === "value" || edgeClass === "mixed";
}

function freeze(sets: Map<NodeId, Set<NodeId>>): Adjacency {
  const frozen = new Map<NodeId, readonly NodeId[]>();
  for (const [id, values] of sets) {
    frozen.set(id, [...values].sort());
  }
  return frozen;
}

export function buildAdjacency(
  nodeIds: readonly NodeId[],
  edges: readonly DirectedEdge[],
  policy: EdgePolicy = "value-and-mixed",
): { forward: Adjacency; reverse: Adjacency } {
  const forward = new Map<NodeId, Set<NodeId>>();
  const reverse = new Map<NodeId, Set<NodeId>>();
  for (const id of nodeIds) {
    forward.set(id, new Set());
    reverse.set(id, new Set());
  }
  for (const edge of edges) {
    if (!includedByPolicy(edge.edgeClass, policy)) {
      continue;
    }
    const fromSet = forward.get(edge.from);
    const toSet = reverse.get(edge.to);
    if (fromSet === undefined || toSet === undefined) {
      continue;
    }
    fromSet.add(edge.to);
    toSet.add(edge.from);
  }
  return { forward: freeze(forward), reverse: freeze(reverse) };
}
