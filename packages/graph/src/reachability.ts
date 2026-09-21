import type { Adjacency, NodeId } from "./adjacency.js";

export const DEFAULT_TRAVERSAL_LIMITS = {
  maxNodes: 10_000,
  maxDepth: 256,
} as const;

export interface ReverseImpactOptions {
  maxNodes?: number;
  maxDepth?: number;
}

export interface ReverseImpact {
  origin: NodeId;
  directImporters: readonly NodeId[];
  transitiveImporters: readonly NodeId[];
  distance: ReadonlyMap<NodeId, number>;
  predecessor: ReadonlyMap<NodeId, NodeId>;
  truncated: boolean;
  truncationReasons: readonly string[];
}

export function reverseImpact(
  origin: NodeId,
  reverse: Adjacency,
  options: ReverseImpactOptions = {},
): ReverseImpact {
  const maxNodes = options.maxNodes ?? DEFAULT_TRAVERSAL_LIMITS.maxNodes;
  const maxDepth = options.maxDepth ?? DEFAULT_TRAVERSAL_LIMITS.maxDepth;
  const visited = new Set<NodeId>([origin]);
  const distance = new Map<NodeId, number>([[origin, 0]]);
  const predecessor = new Map<NodeId, NodeId>();
  const queue: NodeId[] = [origin];
  const truncationReasons: string[] = [];
  let truncated = false;
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (current === undefined) {
      break;
    }
    const depth = distance.get(current) ?? 0;
    if (depth >= maxDepth) {
      truncated = true;
      truncationReasons.push("max-depth");
      continue;
    }
    for (const next of reverse.get(current) ?? []) {
      if (visited.has(next)) {
        continue;
      }
      if (visited.size >= maxNodes) {
        truncated = true;
        truncationReasons.push("max-nodes");
        continue;
      }
      visited.add(next);
      distance.set(next, depth + 1);
      predecessor.set(next, current);
      queue.push(next);
    }
  }

  const discovered = [...visited].filter((id) => id !== origin).sort();
  const directImporters = discovered.filter((id) => distance.get(id) === 1);
  const transitiveImporters = discovered.filter((id) => (distance.get(id) ?? 0) > 1);

  return {
    origin,
    directImporters,
    transitiveImporters,
    distance,
    predecessor,
    truncated,
    truncationReasons: [...new Set(truncationReasons)],
  };
}

export function shortestObservedPath(
  origin: NodeId,
  importer: NodeId,
  predecessor: ReadonlyMap<NodeId, NodeId>,
): NodeId[] | undefined {
  if (importer === origin) {
    return [origin];
  }
  if (!predecessor.has(importer)) {
    return undefined;
  }
  const path = [importer];
  let current = importer;
  const seen = new Set<NodeId>([importer]);
  while (current !== origin) {
    const previous = predecessor.get(current);
    if (previous === undefined) {
      return undefined;
    }
    if (seen.has(previous)) {
      return undefined;
    }
    seen.add(previous);
    path.push(previous);
    current = previous;
  }
  return path;
}

export function paginate<T>(
  items: readonly T[],
  offset: number,
  limit: number,
): { items: readonly T[]; total: number; truncated: boolean } {
  const total = items.length;
  const start = Math.max(0, offset);
  const end = start + Math.max(0, limit);
  return {
    items: items.slice(start, end),
    total,
    truncated: end < total,
  };
}
