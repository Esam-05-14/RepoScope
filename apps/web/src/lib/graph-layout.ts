import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { SemanticEdge } from "@reposcope/contracts";
import type { ComponentEdge, ComponentNode } from "@reposcope/graph";

const BANDS = ["#fffdf8", "#f3f7fb", "#f7f3ea", "#eef6f1", "#f6eef4"];

export function colorForComponent(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 3)) % 997;
  }
  return BANDS[hash % BANDS.length] ?? "#fffdf8";
}

function edgeStroke(edgeClass: string): { stroke: string; strokeDasharray?: string } {
  if (edgeClass === "type") {
    return { stroke: "#8a6d3b", strokeDasharray: "6 4" };
  }
  if (edgeClass === "mixed") {
    return { stroke: "#5c574e" };
  }
  return { stroke: "#1d4f73" };
}

export function layoutFiles(input: {
  nodeIds: readonly string[];
  edges: readonly SemanticEdge[];
  fileComponent: Record<string, string>;
  selected?: string;
  cycles: ReadonlySet<string>;
  neighborhood: ReadonlySet<string>;
}): { nodes: Node[]; flowEdges: Edge[] } {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const id of input.nodeIds) {
    incoming.set(id, 0);
    outgoing.set(id, 0);
  }
  for (const edge of input.edges) {
    if (outgoing.has(edge.importerId)) {
      outgoing.set(edge.importerId, (outgoing.get(edge.importerId) ?? 0) + 1);
    }
    if (edge.targetId !== undefined && incoming.has(edge.targetId)) {
      incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1);
    }
  }
  const columns = new Map<string, number>();
  const assign = (id: string, depth: number): void => {
    const current = columns.get(id);
    if (current !== undefined && current >= depth) {
      return;
    }
    columns.set(id, depth);
  };
  for (const id of input.nodeIds) {
    if ((incoming.get(id) ?? 0) === 0) {
      assign(id, 0);
    }
  }
  for (let pass = 0; pass < input.nodeIds.length; pass += 1) {
    for (const edge of input.edges) {
      if (edge.targetId === undefined) {
        continue;
      }
      assign(edge.targetId, (columns.get(edge.importerId) ?? 0) + 1);
    }
  }

  const components = [...new Set(input.nodeIds.map((id) => input.fileComponent[id] ?? "."))].sort();
  const bandOf = new Map(components.map((id, index) => [id, index]));
  const rowInBand = new Map<string, Map<number, number>>();

  const nodes: Node[] = [];
  for (const id of [...input.nodeIds].sort()) {
    const component = input.fileComponent[id] ?? ".";
    const col = columns.get(id) ?? 0;
    const rows = rowInBand.get(component) ?? new Map<number, number>();
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    rowInBand.set(component, rows);
    const band = bandOf.get(component) ?? 0;
    const inCycle = input.cycles.has(id);
    const near = input.neighborhood.has(id);
    const selected = id === input.selected;
    nodes.push({
      id,
      position: { x: col * 250, y: band * 220 + row * 76 },
      data: {
        label: `${id.split("/").pop() ?? id}\n${component}\nin ${incoming.get(id) ?? 0} · out ${outgoing.get(id) ?? 0}`,
      },
      style: {
        fontSize: 11,
        width: 220,
        border: selected ? "2px solid #1d4f73" : inCycle ? "1px solid #a94442" : "1px solid #c9c2b4",
        background: selected ? "#e7f0f6" : inCycle ? "#f8e6e6" : colorForComponent(component),
        opacity: input.selected !== undefined && !near && !selected ? 0.45 : 1,
      },
    });
  }

  const flowEdges: Edge[] = input.edges.flatMap((edge) => {
    if (edge.targetId === undefined) {
      return [];
    }
    const paint = edgeStroke(edge.edgeClass);
    return [
      {
        id: edge.key,
        source: edge.importerId,
        target: edge.targetId,
        markerEnd: { type: MarkerType.ArrowClosed, color: paint.stroke },
        style: { stroke: paint.stroke, strokeDasharray: paint.strokeDasharray, strokeWidth: 1.4 },
        data: { key: edge.key },
      },
    ];
  });
  return { nodes, flowEdges };
}

export function layoutComponents(input: {
  components: readonly ComponentNode[];
  edges: readonly ComponentEdge[];
  selectedComponent?: string;
}): { nodes: Node[]; flowEdges: Edge[] } {
  const incoming = new Map<string, number>();
  for (const component of input.components) {
    incoming.set(component.id, 0);
  }
  for (const edge of input.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  const columns = new Map<string, number>();
  for (const component of input.components) {
    if ((incoming.get(component.id) ?? 0) === 0) {
      columns.set(component.id, 0);
    }
  }
  for (let pass = 0; pass < input.components.length; pass += 1) {
    for (const edge of input.edges) {
      const from = columns.get(edge.from) ?? 0;
      const current = columns.get(edge.to) ?? 0;
      if (from + 1 > current) {
        columns.set(edge.to, from + 1);
      }
    }
  }
  const buckets = new Map<number, string[]>();
  for (const component of input.components) {
    const col = columns.get(component.id) ?? 0;
    const list = buckets.get(col) ?? [];
    list.push(component.id);
    buckets.set(col, list);
  }
  const byId = new Map(input.components.map((item) => [item.id, item]));
  const nodes: Node[] = [];
  for (const [col, ids] of [...buckets.entries()].sort((left, right) => left[0] - right[0])) {
    ids.forEach((id, index) => {
      const component = byId.get(id);
      if (component === undefined) {
        return;
      }
      const selected = id === input.selectedComponent;
      nodes.push({
        id,
        position: { x: col * 280, y: index * 110 },
        data: {
          label: `${component.id}\n${component.files} files · in ${component.importedBy} · out ${component.imports}`,
        },
        style: {
          fontSize: 12,
          width: 250,
          border: selected ? "2px solid #1d4f73" : "1px solid #c9c2b4",
          background: selected ? "#e7f0f6" : colorForComponent(id),
        },
      });
    });
  }
  const maxCount = Math.max(1, ...input.edges.map((edge) => edge.fileEdges));
  const flowEdges: Edge[] = input.edges.map((edge) => ({
    id: `comp:${edge.from}>${edge.to}`,
    source: edge.from,
    target: edge.to,
    label: String(edge.fileEdges),
    markerEnd: { type: MarkerType.ArrowClosed, color: "#1d4f73" },
    style: { stroke: "#1d4f73", strokeWidth: 1.2 + (2.8 * edge.fileEdges) / maxCount },
    data: { from: edge.from, to: edge.to },
  }));
  return { nodes, flowEdges };
}
