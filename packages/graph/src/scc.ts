import type { Adjacency, NodeId } from "./adjacency.js";

export interface CycleGroup {
  members: readonly NodeId[];
  witnessPath: readonly NodeId[];
}

interface Frame {
  node: NodeId;
  iterator: Iterator<NodeId>;
}

function neighbors(forward: Adjacency, node: NodeId): readonly NodeId[] {
  return forward.get(node) ?? [];
}

function shortestWithin(
  start: NodeId,
  goal: NodeId,
  memberSet: ReadonlySet<NodeId>,
  forward: Adjacency,
): NodeId[] | undefined {
  const queue = [start];
  const predecessor = new Map<NodeId, NodeId>();
  const visited = new Set<NodeId>([start]);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (current === undefined) {
      break;
    }
    if (current === goal) {
      const path = [current];
      let step = current;
      while (step !== start) {
        const previous = predecessor.get(step);
        if (previous === undefined) {
          return undefined;
        }
        path.push(previous);
        step = previous;
      }
      return path.reverse();
    }
    for (const next of neighbors(forward, current)) {
      if (!memberSet.has(next) || visited.has(next)) {
        continue;
      }
      visited.add(next);
      predecessor.set(next, current);
      queue.push(next);
    }
  }
  return undefined;
}

function witnessPath(
  members: readonly NodeId[],
  forward: Adjacency,
): NodeId[] {
  const sorted = [...members].sort();
  const memberSet = new Set(sorted);
  if (sorted.length === 1) {
    const only = sorted[0];
    if (only !== undefined && neighbors(forward, only).includes(only)) {
      return [only, only];
    }
    return sorted;
  }
  for (const from of sorted) {
    for (const to of neighbors(forward, from)) {
      if (!memberSet.has(to)) {
        continue;
      }
      const rest = shortestWithin(to, from, memberSet, forward);
      if (rest !== undefined) {
        return [...rest, to];
      }
    }
  }
  return sorted;
}

export function stronglyConnectedComponents(forward: Adjacency): CycleGroup[] {
  let index = 0;
  const indices = new Map<NodeId, number>();
  const lowlink = new Map<NodeId, number>();
  const stack: NodeId[] = [];
  const onStack = new Set<NodeId>();
  const components: NodeId[][] = [];
  const nodes = [...forward.keys()].sort();

  const start = (node: NodeId): void => {
    indices.set(node, index);
    lowlink.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
  };

  for (const root of nodes) {
    if (indices.has(root)) {
      continue;
    }
    const frames: Frame[] = [
      { node: root, iterator: neighbors(forward, root)[Symbol.iterator]() },
    ];
    start(root);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (frame === undefined) {
        break;
      }
      const next = frame.iterator.next();
      if (!next.done) {
        const successor = next.value;
        const successorIndex = indices.get(successor);
        if (successorIndex === undefined) {
          start(successor);
          frames.push({
            node: successor,
            iterator: neighbors(forward, successor)[Symbol.iterator](),
          });
          continue;
        }
        if (onStack.has(successor)) {
          lowlink.set(
            frame.node,
            Math.min(lowlink.get(frame.node) ?? 0, successorIndex),
          );
        }
        continue;
      }
      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent !== undefined) {
        lowlink.set(
          parent.node,
          Math.min(lowlink.get(parent.node) ?? 0, lowlink.get(frame.node) ?? 0),
        );
      }
      if (lowlink.get(frame.node) === indices.get(frame.node)) {
        const members: NodeId[] = [];
        let popped: NodeId | undefined;
        do {
          popped = stack.pop();
          if (popped === undefined) {
            break;
          }
          onStack.delete(popped);
          members.push(popped);
        } while (popped !== frame.node);
        components.push(members.sort());
      }
    }
  }

  return components
    .filter((members) => {
      if (members.length > 1) {
        return true;
      }
      const only = members[0];
      return only !== undefined && neighbors(forward, only).includes(only);
    })
    .map((members) => ({
      members,
      witnessPath: witnessPath(members, forward),
    }))
    .sort((a, b) => a.members.join("\0").localeCompare(b.members.join("\0")));
}
