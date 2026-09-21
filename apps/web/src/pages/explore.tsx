import { useEffect, useRef, useState, type ReactElement } from "react";
import type { EvidenceResponse, SemanticEdge } from "@reposcope/contracts";
import { cycleGroupsFromSnapshot, impactFromSnapshot } from "../lib/analyze.js";
import { FileTree } from "../components/file-tree.js";
import { GraphView } from "../components/graph-view.js";
import { Inspector } from "../components/inspector.js";
import { RelationList } from "../components/relation-list.js";
import { fetchEvidence, fetchImpact } from "../lib/api.js";
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

  if (snapshot === undefined) {
    return (
      <main className="page">
        <h1>Explore</h1>
        <p>Scan a repository from Overview first.</p>
      </main>
    );
  }

  const cycles = cycleGroupsFromSnapshot(snapshot);

  return (
    <div className={`explorer ${inspectorOpen ? "inspector-open" : ""}`}>
      <aside className="tree-pane">
        <label className="search">
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
        <FileTree
          paths={snapshot.nodes.map((node) => node.id)}
          selected={selected}
          query={query}
          onSelect={(id) => {
            setEdge(undefined);
            void loadFor(id);
          }}
        />
      </aside>
      <section className="center-pane">
        <div className="center-toolbar">
          <button type="button" onClick={() => setListMode(false)}>
            Graph
          </button>
          <button type="button" onClick={() => setListMode(true)}>
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
            onSelectNode={(id) => {
              void loadFor(id);
            }}
            onSelectEdge={(next) => {
              setEdge(next);
              void loadFor(next.importerId, next);
            }}
          />
        )}
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
        evidence={evidence}
        impact={impact}
        onClose={() => {
          setInspectorOpen(false);
          restoreFocus.current?.focus();
        }}
      />
    </div>
  );
}
