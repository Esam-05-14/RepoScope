import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { fileRole, type SemanticEdge } from "@reposcope/contracts";
import type { ComponentEdge, ComponentNode } from "@reposcope/graph";
import type { LibraryDisplayNode } from "./view-filter.js";

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
  if (edgeClass === "library") {
    return { stroke: "#7a6a4f", strokeDasharray: "2 4" };
  }
  return { stroke: "#1d4f73" };
}

function fileTitle(id: string): { title: string; subtitle: string } {
  const parts = id.split("/").filter((part) => part.length > 0);
  const title = parts[parts.length - 1] ?? id;
  const subtitle = parts.slice(0, -1).join("/") || ".";
  return { title, subtitle };
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
    const names = fileTitle(id);
    nodes.push({
      id,
      type: "file",
      position: { x: col * 236, y: band * 200 + row * 92 },
      data: {
        path: id,
        title: names.title,
        subtitle: names.subtitle,
        inbound: incoming.get(id) ?? 0,
        outbound: outgoing.get(id) ?? 0,
        role: fileRole(id),
        inCycle,
      },
      style: {
        background: selected ? "#e7f0f6" : inCycle ? "#f8e6e6" : colorForComponent(component),
        opacity: input.selected !== undefined && !near && !selected ? 0.42 : 1,
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
        style: { stroke: paint.stroke, strokeDasharray: paint.strokeDasharray, strokeWidth: 1.35 },
        data: { key: edge.key },
      },
    ];
  });
  return { nodes, flowEdges };
}

export function layoutLibraries(input: {
  libraries: readonly LibraryDisplayNode[];
  visibleFiles: ReadonlySet<string>;
  column: number;
}): { nodes: Node[]; flowEdges: Edge[] } {
  const nodes: Node[] = input.libraries.slice(0, 40).map((library, index) => ({
    id: library.id,
    type: "library",
    position: { x: input.column * 236, y: index * 92 },
    data: {
      name: library.name,
      kind: library.kind,
      importers: library.importers.length,
    },
  }));
  const flowEdges: Edge[] = [];
  const paint = edgeStroke("library");
  for (const library of input.libraries.slice(0, 40)) {
    for (const importer of library.importers) {
      if (!input.visibleFiles.has(importer)) {
        continue;
      }
      flowEdges.push({
        id: `libedge:${importer}>${library.id}`,
        source: importer,
        target: library.id,
        markerEnd: { type: MarkerType.ArrowClosed, color: paint.stroke },
        style: { stroke: paint.stroke, strokeDasharray: paint.strokeDasharray, strokeWidth: 1.1 },
        data: { library: library.name },
      });
    }
  }
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
      nodes.push({
        id,
        type: "component",
        position: { x: col * 270, y: index * 110 },
        data: {
          title: component.id,
          subtitle: `${component.files} files · in ${component.importedBy} · out ${component.imports}`,
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
