export type NodeId = string;
export type Adjacency = ReadonlyMap<NodeId, readonly NodeId[]>;

export function emptyAdjacency(): Adjacency {
  return new Map();
}
