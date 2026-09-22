import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  parseLibraryNodeId,
  type AnalysisSnapshot,
  type SemanticEdge,
  type ViewLens,
} from "@reposcope/contracts";
import { boundGraph, boundNeighborhood, GRAPH_EDGE_CAP, GRAPH_NODE_CAP } from "../lib/bound-graph.js";
import { layoutComponents, layoutFiles, layoutLibraries } from "../lib/graph-layout.js";
import { cycleGroupsFromSnapshot } from "../lib/analyze.js";
import { libraryDisplayNodes, restrictSnapshot, visibleFileIds } from "../lib/view-filter.js";
import { relationsFromSnapshot } from "../lib/relations.js";
import { COPY } from "../lib/copy.js";
import { neighborhoodOf } from "@reposcope/graph";
import { ComponentGraphNode, FileGraphNode, LibraryGraphNode } from "./graph-nodes.js";

export type GraphMode = "files" | "neighborhood" | "components";

const NODE_TYPES = {
  file: FileGraphNode,
  library: LibraryGraphNode,
  component: ComponentGraphNode,
};

function GraphInner(props: {
  snapshot: AnalysisSnapshot;
  selected?: string;
  lens: ViewLens;
  onSelectNode: (id: string) => void;
  onSelectEdge: (edge: SemanticEdge) => void;
}): ReactElement {
  const flow = useReactFlow();
  const [mode, setMode] = useState<GraphMode>("files");
  const [includeTests, setIncludeTests] = useState(true);
  const [hideIsolated, setHideIsolated] = useState(props.lens === "investigation");
  const [hops, setHops] = useState(2);
  const [nodeCap, setNodeCap] = useState(GRAPH_NODE_CAP);
  const [edgeCap, setEdgeCap] = useState(GRAPH_EDGE_CAP);

  useEffect(() => {
    setHideIsolated(props.lens === "investigation");
  }, [props.lens]);

  const fileIds = useMemo(
    () =>
      visibleFileIds(props.snapshot, {
        lens: props.lens,
        includeTests,
        hideIsolated: props.lens === "investigation" ? hideIsolated : false,
      }),
    [props.snapshot, props.lens, includeTests, hideIsolated],
  );
  const scoped = useMemo(() => restrictSnapshot(props.snapshot, fileIds), [props.snapshot, fileIds]);
  const visibleSet = useMemo(() => new Set(fileIds), [fileIds]);
  const libraries = useMemo(
    () =>
      props.lens === "libraries"
        ? libraryDisplayNodes(props.snapshot, visibleSet, true)
        : [],
    [props.lens, props.snapshot, visibleSet],
  );
  const relations = useMemo(() => relationsFromSnapshot(scoped), [scoped]);
  const cycles = useMemo(() => {
    const set = new Set<string>();
    for (const group of cycleGroupsFromSnapshot(scoped)) {
      if (group.members.length > 1) {
        for (const member of group.members) {
          set.add(member);
        }
      }
    }
    return set;
  }, [scoped]);
  const nearby = useMemo(() => {
    if (props.selected === undefined || parseLibraryNodeId(props.selected) !== undefined) {
      return new Set(scoped.nodes.map((node) => node.id));
    }
    return neighborhoodOf(
      props.selected,
      scoped.semanticEdges.map((edge) => ({
        importerId: edge.importerId,
        targetId: edge.targetId,
        edgeClass: edge.edgeClass,
      })),
      1,
      scoped.scope.edgePolicy,
    );
  }, [scoped, props.selected]);

  const bounded = useMemo(() => {
    if (mode === "neighborhood" && props.selected !== undefined && parseLibraryNodeId(props.selected) === undefined) {
      return boundNeighborhood(scoped, props.selected, { hops, nodeCap, edgeCap });
    }
    return boundGraph(scoped, props.selected, { nodeCap, edgeCap, hideIsolated: false });
  }, [mode, scoped, props.selected, hops, nodeCap, edgeCap]);

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
  const libraryLayout = useMemo(() => {
    if (props.lens !== "libraries" || mode === "components") {
      return { nodes: [], flowEdges: [] };
    }
    const maxCol =
      fileLayout.nodes.reduce((max, node) => Math.max(max, Math.round(node.position.x / 236)), 0) + 1;
    return layoutLibraries({
      libraries,
      visibleFiles: new Set(bounded.nodeIds),
      column: maxCol,
    });
  }, [props.lens, mode, fileLayout.nodes, libraries, bounded.nodeIds]);
  const selectedComponent =
    props.selected === undefined || parseLibraryNodeId(props.selected) !== undefined
      ? undefined
      : relations.fileComponent[props.selected];
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

  const drawn = useMemo(() => {
    if (mode === "components") {
      return componentLayout;
    }
    return {
      nodes: [...fileLayout.nodes, ...libraryLayout.nodes],
      flowEdges: [...fileLayout.flowEdges, ...libraryLayout.flowEdges],
    };
  }, [mode, componentLayout, fileLayout, libraryLayout]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void flow.fitView({ padding: 0.18, duration: 180 });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [flow, mode, props.lens, hops, includeTests, hideIsolated]);

  return (
    <div className="graph-pane" data-testid="graph-pane">
      <p className="muted">{mode === "components" ? COPY.component : COPY.arrow}</p>
      <div className="graph-toolbar" role="toolbar" aria-label="Graph layout">
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
        {props.lens === "investigation" && mode === "files" ? (
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
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeTests}
            onChange={(event) => {
              setIncludeTests(event.target.checked);
            }}
          />
          Tests
        </label>
      </div>
      <p className="graph-legend muted">
        {props.lens === "libraries"
          ? "Tan dotted edges are observed library specifiers. They are not installed or executed."
          : "Solid value · dashed type-only · red outline is an observed cycle member."}
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
      {mode === "neighborhood" &&
      (props.selected === undefined || parseLibraryNodeId(props.selected) !== undefined) ? (
        <p>Select a file to show its observed neighborhood.</p>
      ) : null}
      <div className="graph-canvas">
        <ReactFlow
          nodes={drawn.nodes.map((node) => ({
            ...node,
            selected:
              mode === "components" ? node.id === selectedComponent : node.id === props.selected,
          }))}
          edges={drawn.flowEdges}
          nodeTypes={NODE_TYPES}
          fitView
          minZoom={0.12}
          onNodeClick={(_event, node) => {
            if (mode === "components") {
              const files = scoped.nodes
                .map((item) => item.id)
                .filter((id) => relations.fileComponent[id] === node.id);
              const importedBy = new Map<string, number>();
              for (const edge of scoped.semanticEdges) {
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
            if (typeof edge.data?.library === "string") {
              props.onSelectNode(`lib:${edge.data.library}`);
              return;
            }
            const semantic = edgeByKey.get(edge.id);
            if (semantic !== undefined) {
              props.onSelectEdge(semantic);
            }
          }}
        >
          <Background gap={18} color="#e6e0d4" />
          {drawn.nodes.length > 16 ? <MiniMap pannable zoomable /> : null}
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export function GraphView(props: {
  snapshot: AnalysisSnapshot;
  selected?: string;
  lens: ViewLens;
  onSelectNode: (id: string) => void;
  onSelectEdge: (edge: SemanticEdge) => void;
}): ReactElement {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
