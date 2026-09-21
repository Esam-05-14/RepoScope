import type { AnalysisSnapshot, SemanticEdge } from "@reposcope/contracts";
import { includedByPolicy } from "@reposcope/graph";
import type { ReactElement } from "react";

export function RelationList(props: {
  snapshot: AnalysisSnapshot;
  selected?: string;
  onSelectNode: (id: string) => void;
  onSelectEdge: (edge: SemanticEdge) => void;
}): ReactElement {
  const policy = props.snapshot.scope.edgePolicy;
  const edges = props.snapshot.semanticEdges.filter((edge) =>
    includedByPolicy(edge.edgeClass, policy),
  );
  const visible =
    props.selected === undefined
      ? edges
      : edges.filter(
          (edge) => edge.importerId === props.selected || edge.targetId === props.selected,
        );

  return (
    <div className="relation-list" data-testid="relation-list">
      <h2>Observed dependencies</h2>
      {visible.length === 0 ? (
        <p>No observed dependencies in this filter.</p>
      ) : (
        <ul>
          {visible.map((edge) => {
            const target = edge.targetId ?? edge.unresolvedSpecifier ?? "(unresolved)";
            return (
              <li key={edge.key}>
                <button
                  type="button"
                  onClick={() => {
                    props.onSelectEdge(edge);
                    props.onSelectNode(edge.importerId);
                  }}
                >
                  {edge.importerId} → {target}
                </button>
                <span className="muted">
                  {" "}
                  {edge.edgeClass} {edge.syntaxClass}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
