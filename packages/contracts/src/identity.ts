import type { EdgeClass } from "./status.js";
import type { SemanticEdge, SyntaxClass } from "./snapshot.js";

export function semanticEdgeKey(input: {
  importerId: string;
  targetKey: string;
  syntaxClass: SyntaxClass;
  edgeClass: EdgeClass;
}): string {
  return `${input.importerId}>|${input.targetKey}|${input.syntaxClass}|${input.edgeClass}`;
}

export function targetKeyForEdge(edge: SemanticEdge): string {
  if (edge.targetId !== undefined) {
    return `internal:${edge.targetId}`;
  }
  if (edge.unresolvedSpecifier !== undefined) {
    return `unresolved:${edge.unresolvedSpecifier}`;
  }
  return "unresolved:";
}

export function syntaxClassOf(
  syntaxKind: string,
): SyntaxClass {
  if (syntaxKind === "export-from" || syntaxKind === "type-only-export-from") {
    return "export-from";
  }
  if (syntaxKind === "mixed-import" || syntaxKind === "mixed-export-from") {
    return "mixed";
  }
  return "static-import";
}
