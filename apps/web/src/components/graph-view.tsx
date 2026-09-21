import { useMemo, type ReactElement } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { AnalysisSnapshot, SemanticEdge } from "@reposcope/contracts";
import { boundGraph, GRAPH_EDGE_CAP, GRAPH_NODE_CAP } from "../lib/bound-graph.js";
import { COPY } from "../lib/copy.js";

function layout(
  nodeIds: readonly string[],
  edges: readonly SemanticEdge[],
): { nodes: Node[]; flowEdges: Edge[] } {
  const incoming = new Map<string, number>();
  for (const id of nodeIds) {
    incoming.set(id, 0);
  }
  for (const edge of edges) {
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
  for (const id of nodeIds) {
    if ((incoming.get(id) ?? 0) === 0) {
      assign(id, 0);
    }
  }
  for (let pass = 0; pass < nodeIds.length; pass += 1) {
    for (const edge of edges) {
      if (edge.targetId === undefined) {
        continue;
      }
      const from = columns.get(edge.importerId) ?? 0;
      assign(edge.targetId, from + 1);
    }
  }
  const buckets = new Map<number, string[]>();
  for (const id of nodeIds) {
    const col = columns.get(id) ?? 0;
    const list = buckets.get(col) ?? [];
    list.push(id);
    buckets.set(col, list);
  }
  const nodes: Node[] = [];
  for (const [col, ids] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    ids.forEach((id, index) => {
      nodes.push({
        id,
        position: { x: col * 240, y: index * 72 },
        data: { label: id },
        style: {
          fontSize: 12,
          width: 200,
        },
      });
    });
  }
  const flowEdges: Edge[] = edges.flatMap((edge) => {
    if (edge.targetId === undefined) {
      return [];
    }
    return [
      {
        id: edge.key,
        source: edge.importerId,
        target: edge.targetId,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { key: edge.key },
      },
    ];
  });
  return { nodes, flowEdges };
}

function GraphInner(props: {
  snapshot: AnalysisSnapshot;
  selected?: string;
  onSelectNode: (id: string) => void;
  onSelectEdge: (edge: SemanticEdge) => void;
}): ReactElement {
  const bounded = useMemo(
    () => boundGraph(props.snapshot, props.selected),
    [props.snapshot, props.selected],
  );
  const { nodes, flowEdges } = useMemo(
    () => layout(bounded.nodeIds, bounded.edges),
    [bounded],
  );
  const edgeByKey = useMemo(() => {
    const map = new Map<string, SemanticEdge>();
    for (const edge of bounded.edges) {
      map.set(edge.key, edge);
    }
    return map;
  }, [bounded.edges]);

  return (
    <div className="graph-pane" data-testid="graph-pane">
      <p className="muted">{COPY.arrow}</p>
      {bounded.truncated ? (
        <p role="status">
          Graph truncated to {GRAPH_NODE_CAP} files and {GRAPH_EDGE_CAP} relations around the
          selection.
        </p>
      ) : null}
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            selected: node.id === props.selected,
          }))}
          edges={flowEdges}
          fitView
          minZoom={0.2}
          onNodeClick={(_event, node) => {
            props.onSelectNode(node.id);
          }}
          onEdgeClick={(_event, edge) => {
            const semantic = edgeByKey.get(edge.id);
            if (semantic !== undefined) {
              props.onSelectEdge(semantic);
            }
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export function GraphView(props: {
  snapshot: AnalysisSnapshot;
  selected?: string;
  onSelectNode: (id: string) => void;
  onSelectEdge: (edge: SemanticEdge) => void;
}): ReactElement {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
