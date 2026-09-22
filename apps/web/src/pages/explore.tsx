import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { EvidenceResponse, SemanticEdge } from "@reposcope/contracts";
import { cycleGroupsFromSnapshot, impactFromSnapshot } from "../lib/analyze.js";
import { FileTree } from "../components/file-tree.js";
import { GraphView } from "../components/graph-view.js";
import { Inspector } from "../components/inspector.js";
import { RelationList } from "../components/relation-list.js";
import { fetchEvidence, fetchImpact, openInEditor } from "../lib/api.js";
import { parseLibraryNodeId } from "@reposcope/contracts";
import { briefFromSnapshot } from "../lib/brief.js";
import { useViewLens } from "../lib/lens.js";
import { fileRelationsFromSnapshot, relationsFromSnapshot } from "../lib/relations.js";
import { COPY } from "../lib/copy.js";
import { useWorkspace } from "../workspace.js";

export function ExplorePage(): ReactElement {
  const workspace = useWorkspace();
  const snapshot = workspace.snapshot;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const [edge, setEdge] = useState<SemanticEdge>();
  const [evidence, setEvidence] = useState<EvidenceResponse>();
  const [impact, setImpact] = useState<{
    directImporters: string[];
    transitiveImporters: string[];
    shortestObservedPathFrom: Record<string, string[]>;
  }>();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [lens, setLens] = useViewLens();
  const searchRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setInspectorOpen(false);
        restoreFocus.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      setListMode(true);
    }
  }, []);

  async function loadFor(node: string, nextEdge?: SemanticEdge): Promise<void> {
    if (workspace.snapshotId === undefined || snapshot === undefined) {
      return;
    }
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (parseLibraryNodeId(node) !== undefined) {
      setSelected(node);
      setInspectorOpen(true);
      setEdge(undefined);
      setEvidence(undefined);
      setImpact(undefined);
      return;
    }
    setSelected(node);
    setInspectorOpen(true);
    const local = impactFromSnapshot(snapshot, node);
    const shortestObservedPathFrom: Record<string, string[]> = {};
    for (const importer of [...local.directImporters, ...local.transitiveImporters]) {
      const path = local.shortestPathFrom(importer);
      if (path !== undefined) {
        shortestObservedPathFrom[importer] = path;
      }
    }
    setImpact({
      directImporters: [...local.directImporters],
      transitiveImporters: [...local.transitiveImporters],
      shortestObservedPathFrom,
    });
    try {
      const remote = await fetchImpact(workspace.snapshotId, node);
      setImpact({
        directImporters: remote.directImporters,
        transitiveImporters: remote.transitiveImporters,
        shortestObservedPathFrom: remote.shortestObservedPathFrom,
      });
    } catch {
      // Keep the local reverse-impact view if the API is unreachable.
    }
    const incoming = snapshot.semanticEdges.find((item) => item.targetId === node);
    const outgoing = snapshot.semanticEdges.find((item) => item.importerId === node);
    const chosen = nextEdge ?? incoming ?? outgoing;
    setEdge(chosen);
    const observationId = chosen?.observationIds[0];
    if (chosen === undefined || observationId === undefined) {
      setEvidence(undefined);
      return;
    }
    try {
      setEvidence(await fetchEvidence(workspace.snapshotId, observationId));
    } catch (caught) {
      setEvidence({
        status: "unavailable",
        observationId,
        importerId: chosen.importerId,
        specifier: chosen.unresolvedSpecifier ?? "",
        expectedHash: "",
        snippet: caught instanceof Error ? caught.message : undefined,
      });
    }
  }

  const packed = useMemo(
    () => (snapshot === undefined ? undefined : briefFromSnapshot(snapshot)),
    [snapshot],
  );
  const importedBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of packed?.brief.files ?? []) {
      map.set(file.id, file.importedBy);
    }
    return map;
  }, [packed]);

  if (snapshot === undefined || packed === undefined) {
    return (
      <main className="page">
        <h1>Explore</h1>
        <p>Scan a repository from Overview first.</p>
      </main>
    );
  }

  const cycles = cycleGroupsFromSnapshot(snapshot);
  const relations = relationsFromSnapshot(snapshot);
  const libraryName = selected === undefined ? undefined : parseLibraryNodeId(selected);
  const library = packed.brief.externals.find((item) => item.name === libraryName);
  const fileRelations =
    selected === undefined || libraryName !== undefined
      ? undefined
      : fileRelationsFromSnapshot(snapshot, selected);
  const selectedFacts = packed.brief.files.find((file) => file.id === selected);
  const selectedNode = snapshot.nodes.find((node) => node.id === selected);
  const selectedContext = snapshot.projectContexts?.find(
    (context) => context.id === selectedNode?.projectContextId,
  );
  const outgoing = snapshot.semanticEdges.filter((item) => item.importerId === selected);
  const incoming = snapshot.semanticEdges.filter((item) => item.targetId === selected);

  return (
    <div className={`explorer${inspectorOpen ? " inspector-open" : ""}${listMode ? " list-mode" : ""}`}>
      <aside className="tree-pane">
        <FileTree
          paths={snapshot.nodes.map((node) => node.id)}
          selected={selected}
          query={query}
          importedBy={importedBy}
          onSelect={(id) => {
            setEdge(undefined);
            void loadFor(id);
          }}
        />
      </aside>
      <section className="center-pane">
        <div className="center-toolbar">
          <label className="search search-inline">
            Search files
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Filter paths"
            />
          </label>
          <button
            type="button"
            data-testid="lens-investigation"
            aria-pressed={lens === "investigation"}
            onClick={() => setLens("investigation")}
          >
            Your code
          </button>
          <button
            type="button"
            data-testid="lens-libraries"
            aria-pressed={lens === "libraries"}
            onClick={() => setLens("libraries")}
          >
            Libraries
          </button>
          <button type="button" aria-pressed={!listMode} onClick={() => setListMode(false)}>
            Graph
          </button>
          <button type="button" aria-pressed={listMode} onClick={() => setListMode(true)}>
            List
          </button>
        </div>
        {listMode ? (
          <RelationList
            snapshot={snapshot}
            selected={selected}
            onSelectNode={(id) => {
              void loadFor(id, edge);
            }}
            onSelectEdge={(next) => {
              setEdge(next);
              void loadFor(next.importerId, next);
            }}
          />
        ) : (
          <GraphView
            snapshot={snapshot}
            selected={selected}
            lens={lens}
            onSelectNode={(id) => {
              void loadFor(id);
            }}
            onSelectEdge={(next) => {
              setEdge(next);
              void loadFor(next.importerId, next);
            }}
          />
        )}
        <p className="muted explore-lens-copy">
          {lens === "libraries" ? COPY.libraries : COPY.yourCode}
        </p>
        <section className="cycles" data-testid="component-relations">
          <h2>Component relations</h2>
          <p className="muted">{COPY.component}</p>
          {relations.componentEdges.length === 0 ? (
            <p>No observed imports that cross a directory or workspace-package prefix.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>File edges</th>
                </tr>
              </thead>
              <tbody>
                {relations.componentEdges.slice(0, 24).map((edge) => (
                  <tr key={`${edge.from}>${edge.to}`}>
                    <td>{edge.from}</td>
                    <td>{edge.to}</td>
                    <td>{edge.fileEdges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="cycles" data-testid="cycle-groups">
          <h2>Cycle groups</h2>
          <p className="muted">{COPY.cycle}</p>
          {cycles.length === 0 ? (
            <p>No observed cycles under the current edge policy.</p>
          ) : (
            <ul>
              {cycles.map((group) => (
                <li key={group.members.join(",")}>{group.members.join(" → ")}</li>
              ))}
            </ul>
          )}
        </section>
      </section>
      <Inspector
        open={inspectorOpen}
        edge={edge}
        selectedNode={selected}
        node={selectedNode}
        imports={selectedFacts?.imports}
        importedBy={selectedFacts?.importedBy}
        outgoing={outgoing}
        incoming={incoming}
        contextPath={selectedContext?.configPath}
        pathMappings={selectedContext?.pathMappings}
        componentId={fileRelations?.componentId}
        boundary={fileRelations?.boundary}
        barrel={fileRelations?.barrel}
        crossComponentImports={fileRelations?.crossComponentImports}
        crossComponentImportedBy={fileRelations?.crossComponentImportedBy}
        coImported={fileRelations?.coImported}
        evidence={evidence}
        impact={impact}
        libraryName={library?.name}
        libraryImporters={library?.importers}
        onSelectNode={(id) => {
          void loadFor(id);
        }}
        onOpenEditor={
          selected === undefined ||
          libraryName !== undefined ||
          workspace.snapshotId === undefined
            ? undefined
            : async () => {
                const snapshotId = workspace.snapshotId;
                const nodeId = selected;
                if (snapshotId === undefined || nodeId === undefined) {
                  return;
                }
                const observation = snapshot.observations.find((item) =>
                  edge?.observationIds.includes(item.id),
                );
                await openInEditor({
                  snapshotId,
                  nodeId,
                  line: observation?.range.startLine,
                  column: observation?.range.startColumn,
                });
              }
        }
        onClose={() => {
          setInspectorOpen(false);
          restoreFocus.current?.focus();
        }}
      />
    </div>
  );
}
