import { useMemo, useState, type ReactElement } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import type { AnalysisSnapshot, SemanticEdge } from "@reposcope/contracts";
import { boundGraph, boundNeighborhood, GRAPH_EDGE_CAP, GRAPH_NODE_CAP } from "../lib/bound-graph.js";
import { layoutComponents, layoutFiles } from "../lib/graph-layout.js";
import { cycleGroupsFromSnapshot } from "../lib/analyze.js";
import { relationsFromSnapshot } from "../lib/relations.js";
import { COPY } from "../lib/copy.js";
import { neighborhoodOf } from "@reposcope/graph";

export type GraphMode = "files" | "neighborhood" | "components";

function GraphInner(props: {
  snapshot: AnalysisSnapshot;
  selected?: string;
  onSelectNode: (id: string) => void;
  onSelectEdge: (edge: SemanticEdge) => void;
}): ReactElement {
  const [mode, setMode] = useState<GraphMode>("files");
  const [hideIsolated, setHideIsolated] = useState(false);
  const [hops, setHops] = useState(2);
  const [nodeCap, setNodeCap] = useState(GRAPH_NODE_CAP);
  const [edgeCap, setEdgeCap] = useState(GRAPH_EDGE_CAP);
  const relations = useMemo(() => relationsFromSnapshot(props.snapshot), [props.snapshot]);
  const cycles = useMemo(() => {
    const set = new Set<string>();
    for (const group of cycleGroupsFromSnapshot(props.snapshot)) {
      if (group.members.length > 1) {
        for (const member of group.members) {
          set.add(member);
        }
      }
    }
    return set;
  }, [props.snapshot]);
  const nearby = useMemo(() => {
    if (props.selected === undefined) {
      return new Set(props.snapshot.nodes.map((node) => node.id));
    }
    return neighborhoodOf(
      props.selected,
      props.snapshot.semanticEdges.map((edge) => ({
        importerId: edge.importerId,
        targetId: edge.targetId,
        edgeClass: edge.edgeClass,
      })),
      1,
      props.snapshot.scope.edgePolicy,
    );
  }, [props.snapshot, props.selected]);

  const bounded = useMemo(() => {
    if (mode === "neighborhood" && props.selected !== undefined) {
      return boundNeighborhood(props.snapshot, props.selected, { hops, nodeCap, edgeCap });
    }
    return boundGraph(props.snapshot, props.selected, { nodeCap, edgeCap, hideIsolated });
  }, [mode, props.snapshot, props.selected, hops, nodeCap, edgeCap, hideIsolated]);

  const fileLayout = useMemo(
    () =>
      layoutFiles({
        nodeIds: bounded.nodeIds,
        edges: bounded.edges,
        fileComponent: relations.fileComponent,
        selected: props.selected,
        cycles,
        neighborhood: nearby,
      }),
    [bounded, relations.fileComponent, props.selected, cycles, nearby],
  );
  const selectedComponent =
    props.selected === undefined ? undefined : relations.fileComponent[props.selected];
  const componentLayout = useMemo(
    () =>
      layoutComponents({
        components: relations.components,
        edges: relations.componentEdges,
        selectedComponent,
      }),
    [relations, selectedComponent],
  );
  const edgeByKey = useMemo(() => {
    const map = new Map<string, SemanticEdge>();
    for (const edge of bounded.edges) {
      map.set(edge.key, edge);
    }
    return map;
  }, [bounded.edges]);

  const drawn = mode === "components" ? componentLayout : fileLayout;

  return (
    <div className="graph-pane" data-testid="graph-pane">
      <p className="muted">{mode === "components" ? COPY.component : COPY.arrow}</p>
      <div className="graph-toolbar">
        <button type="button" aria-pressed={mode === "files"} onClick={() => setMode("files")}>
          Files
        </button>
        <button
          type="button"
          aria-pressed={mode === "neighborhood"}
          data-testid="graph-neighborhood"
          onClick={() => setMode("neighborhood")}
        >
          Nearby
        </button>
        <button
          type="button"
          aria-pressed={mode === "components"}
          data-testid="graph-components"
          onClick={() => setMode("components")}
        >
          Components
        </button>
        {mode === "neighborhood" ? (
          <label className="graph-hop">
            Hops
            <select
              value={hops}
              onChange={(event) => {
                setHops(Number.parseInt(event.target.value, 10));
              }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        ) : null}
        {mode === "files" ? (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={hideIsolated}
              onChange={(event) => {
                setHideIsolated(event.target.checked);
              }}
            />
            Hide isolated
          </label>
        ) : null}
      </div>
      <p className="graph-legend muted">
        Solid value · dashed type-only · mixed darker · red border is an observed cycle member ·
        bands are component prefixes
      </p>
      {bounded.truncated && mode !== "components" ? (
        <p role="status">
          Graph truncated to {nodeCap} files and {edgeCap} relations around the selection.
          <button
            type="button"
            data-testid="graph-expand"
            onClick={() => {
              setNodeCap((current) => current + GRAPH_NODE_CAP);
              setEdgeCap((current) => current + GRAPH_EDGE_CAP);
            }}
          >
            Show more files
          </button>
        </p>
      ) : null}
      {mode === "neighborhood" && props.selected === undefined ? (
        <p>Select a file to show its observed neighborhood.</p>
      ) : null}
      <div className="graph-canvas">
        <ReactFlow
          nodes={drawn.nodes.map((node) => ({
            ...node,
            selected: mode === "components" ? node.id === selectedComponent : node.id === props.selected,
          }))}
          edges={drawn.flowEdges}
          fitView
          minZoom={0.15}
          onNodeClick={(_event, node) => {
            if (mode === "components") {
              const files = props.snapshot.nodes
                .map((item) => item.id)
                .filter((id) => relations.fileComponent[id] === node.id);
              const importedBy = new Map<string, number>();
              for (const edge of props.snapshot.semanticEdges) {
                if (edge.targetId !== undefined && files.includes(edge.targetId)) {
                  importedBy.set(edge.targetId, (importedBy.get(edge.targetId) ?? 0) + 1);
                }
              }
              const hub = [...files].sort(
                (left, right) =>
                  (importedBy.get(right) ?? 0) - (importedBy.get(left) ?? 0) || left.localeCompare(right),
              )[0];
              if (hub !== undefined) {
                props.onSelectNode(hub);
              }
              return;
            }
            props.onSelectNode(node.id);
          }}
          onEdgeClick={(_event, edge) => {
            if (mode === "components") {
              const semantic = relations.componentEdges.find(
                (item) => item.from === edge.source && item.to === edge.target,
              );
              const example = semantic?.examples[0];
              if (example !== undefined) {
                props.onSelectNode(example.importerId);
              }
              return;
            }
            const semantic = edgeByKey.get(edge.id);
            if (semantic !== undefined) {
              props.onSelectEdge(semantic);
            }
          }}
        >
          <Background />
          <MiniMap pannable zoomable />
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
