import { useEffect, useRef, type ReactElement } from "react";
import type { EvidenceResponse, SemanticEdge } from "@reposcope/contracts";
import { COPY } from "../lib/copy.js";

export function Inspector(props: {
  open: boolean;
  edge?: SemanticEdge;
  evidence?: EvidenceResponse;
  impact?: {
    directImporters: string[];
    transitiveImporters: string[];
    shortestObservedPathFrom: Record<string, string[]>;
  };
  onClose: () => void;
}): ReactElement | null {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (props.open) {
      closeRef.current?.focus();
    }
  }, [props.open]);

  if (!props.open) {
    return null;
  }

  const target = props.edge?.targetId ?? props.edge?.unresolvedSpecifier ?? "";

  return (
    <aside className="inspector" data-testid="inspector" role="dialog" aria-label="Evidence">
      <div className="inspector-header">
        <h2>Evidence</h2>
        <button ref={closeRef} type="button" onClick={props.onClose}>
          Close
        </button>
      </div>
      {props.edge !== undefined ? (
        <p>
          Declared value import: <code>{props.edge.importerId}</code> → <code>{target}</code>
        </p>
      ) : (
        <p>Select a file or observed dependency.</p>
      )}
      {props.edge?.targetId === undefined ? <p>{COPY.unresolved}</p> : null}
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
              <li key={from}>
                {path.join(" → ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
