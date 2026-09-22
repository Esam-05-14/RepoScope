import { useEffect, useRef, useState, type ReactElement } from "react";
import type { EvidenceResponse, FileNode, SemanticEdge } from "@reposcope/contracts";
import { COPY } from "../lib/copy.js";

function edgeSummary(edge: SemanticEdge): string {
  const target = edge.targetId ?? edge.unresolvedSpecifier ?? "";
  if (edge.edgeClass === "type") {
    return `${COPY.typeOnly} ${edge.importerId} → ${target}`;
  }
  if (edge.targetId === undefined) {
    return `${COPY.unresolved} ${edge.importerId} → ${target}`;
  }
  return `Declared value import: ${edge.importerId} → ${target}`;
}

export function Inspector(props: {
  open: boolean;
  edge?: SemanticEdge;
  selectedNode?: string;
  node?: FileNode;
  imports?: number;
  importedBy?: number;
  outgoing?: SemanticEdge[];
  incoming?: SemanticEdge[];
  evidence?: EvidenceResponse;
  impact?: {
    directImporters: string[];
    transitiveImporters: string[];
    shortestObservedPathFrom: Record<string, string[]>;
  };
  contextPath?: string | null;
  pathMappings?: string[];
  componentId?: string;
  boundary?: boolean;
  barrel?: boolean;
  crossComponentImports?: { fileId: string; componentId: string }[];
  crossComponentImportedBy?: { fileId: string; componentId: string }[];
  coImported?: { fileId: string; sharedImporters: string[] }[];
  libraryName?: string;
  libraryImporters?: string[];
  onOpenEditor?: () => Promise<void>;
  onSelectNode?: (id: string) => void;
  onClose: () => void;
}): ReactElement | null {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [editorMessage, setEditorMessage] = useState<string>();
  useEffect(() => {
    if (props.open) {
      closeRef.current?.focus();
      setEditorMessage(undefined);
    }
  }, [props.open]);

  if (!props.open) {
    return null;
  }

  const names = props.edge?.importedNames ?? [];

  return (
    <aside className="inspector" data-testid="inspector" role="dialog" aria-label="Evidence">
      <div className="inspector-header">
        <h2>Evidence</h2>
        <button ref={closeRef} type="button" onClick={props.onClose}>
          Close
        </button>
      </div>
      {props.libraryName !== undefined ? (
        <section>
          <h3>{props.libraryName}</h3>
          <p className="muted">{COPY.libraries}</p>
          <ul>
            {(props.libraryImporters ?? []).map((importer) => (
              <li key={importer}>
                <button type="button" onClick={() => props.onSelectNode?.(importer)}>
                  {importer}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.node !== undefined ? (
        <section>
          <h3>{props.node.id}</h3>
          <ul className="fact-list">
            <li>Language: {props.node.language}</li>
            <li>Parse: {props.node.parseStatus}</li>
            <li>Context: {props.node.projectContextId}</li>
            {props.contextPath !== undefined && props.contextPath !== null ? (
              <li>Config: {props.contextPath}</li>
            ) : null}
            {props.componentId !== undefined ? <li>Component: {props.componentId}</li> : null}
            <li>Imports: {props.imports ?? 0} observed files</li>
            <li>Imported by: {props.importedBy ?? 0} observed files</li>
            {props.boundary === true ? <li>{COPY.boundary}</li> : null}
            {props.barrel === true ? <li>{COPY.barrel}</li> : null}
          </ul>
        </section>
      ) : null}
      {props.pathMappings !== undefined && props.pathMappings.length > 0 ? (
        <section>
          <h3>Path mappings</h3>
          <p className="muted">Declared tsconfig paths for this file context, not a runtime resolution proof.</p>
          <ul>
            {props.pathMappings.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.edge !== undefined ? <p>{edgeSummary(props.edge)}</p> : <p>Select a file or observed dependency.</p>}
      {props.edge?.targetId === undefined && props.edge !== undefined ? <p>{COPY.unresolved}</p> : null}
      {names.length > 0 ? (
        <section>
          <h3>Declared bindings</h3>
          <p className="muted">{COPY.declaredNames}</p>
          <p data-testid="declared-names">{names.join(", ")}</p>
        </section>
      ) : null}
      {props.outgoing !== undefined && props.outgoing.length > 0 ? (
        <section>
          <h3>Imports</h3>
          <ul>
            {props.outgoing.map((edge) => (
              <li key={edge.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (edge.targetId !== undefined) {
                      props.onSelectNode?.(edge.targetId);
                    }
                  }}
                >
                  → {edge.targetId ?? edge.unresolvedSpecifier} ({edge.edgeClass})
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.crossComponentImports !== undefined && props.crossComponentImports.length > 0 ? (
        <section>
          <h3>Cross-component imports</h3>
          <p className="muted">{COPY.component}</p>
          <ul>
            {props.crossComponentImports.map((item) => (
              <li key={item.fileId}>
                <button type="button" onClick={() => props.onSelectNode?.(item.fileId)}>
                  → {item.fileId} ({item.componentId})
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.crossComponentImportedBy !== undefined && props.crossComponentImportedBy.length > 0 ? (
        <section>
          <h3>Imported from other components</h3>
          <ul>
            {props.crossComponentImportedBy.map((item) => (
              <li key={item.fileId}>
                <button type="button" onClick={() => props.onSelectNode?.(item.fileId)}>
                  {item.fileId} → ({item.componentId})
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.coImported !== undefined && props.coImported.length > 0 ? (
        <section>
          <h3>Co-imported files</h3>
          <p className="muted">{COPY.coImported}</p>
          <ul>
            {props.coImported.map((item) => (
              <li key={item.fileId}>
                <button type="button" onClick={() => props.onSelectNode?.(item.fileId)}>
                  {item.fileId} · {item.sharedImporters.length} shared importer
                  {item.sharedImporters.length === 1 ? "" : "s"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.incoming !== undefined && props.incoming.length > 0 ? (
        <section>
          <h3>Imported by</h3>
          <ul>
            {props.incoming.map((edge) => (
              <li key={edge.key}>
                <button
                  type="button"
                  onClick={() => {
                    props.onSelectNode?.(edge.importerId);
                  }}
                >
                  {edge.importerId} → ({edge.edgeClass})
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.selectedNode !== undefined && props.onOpenEditor !== undefined ? (
        <p>
          <button
            type="button"
            data-testid="open-editor"
            onClick={() => {
              void props.onOpenEditor?.()
                .then(() => {
                  setEditorMessage("Requested the local editor.");
                })
                .catch((caught: unknown) => {
                  setEditorMessage(caught instanceof Error ? caught.message : "editor open failed");
                });
            }}
          >
            Open in editor
          </button>
        </p>
      ) : null}
      {editorMessage !== undefined ? <p className="muted">{editorMessage}</p> : null}
      {props.evidence !== undefined ? (
        <section>
          <p data-testid="evidence-status">Evidence {props.evidence.status}</p>
          {props.evidence.snippet !== undefined ? (
            <pre data-testid="evidence-snippet">{props.evidence.snippet}</pre>
          ) : null}
          <p className="muted">Hash {props.evidence.expectedHash}</p>
        </section>
      ) : null}
      {props.impact !== undefined ? (
        <section>
          <h3>Reverse impact</h3>
          <p className="muted">{COPY.impact}</p>
          <p>Direct importers: {props.impact.directImporters.join(", ") || "none"}</p>
          <p>Transitive importers: {props.impact.transitiveImporters.join(", ") || "none"}</p>
          <ul>
            {Object.entries(props.impact.shortestObservedPathFrom).map(([from, path]) => (
              <li key={from}>{path.join(" → ")}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
