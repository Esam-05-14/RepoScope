import type { AnalysisSnapshot } from "@reposcope/contracts";

export interface ExpectedEdge {
  from: string;
  to: string;
  specifier: string;
  syntaxKind: string;
  edgeClass: string;
}

export function valueEdgesFrom(snapshot: AnalysisSnapshot): ExpectedEdge[] {
  return snapshot.observations
    .filter(
      (observation) =>
        observation.resolution.status === "internal" &&
        observation.resolution.targetId !== undefined &&
        (observation.edgeClass === "value" || observation.edgeClass === "mixed") &&
        (observation.syntaxKind === "static-import" ||
          observation.syntaxKind === "export-from" ||
          observation.syntaxKind === "mixed-import" ||
          observation.syntaxKind === "mixed-export-from"),
    )
    .map((observation) => ({
      from: observation.importerId,
      to: observation.resolution.targetId as string,
      specifier: observation.specifier,
      syntaxKind: observation.syntaxKind,
      edgeClass: observation.edgeClass,
    }))
    .sort((a, b) => `${a.from}:${a.to}:${a.specifier}`.localeCompare(`${b.from}:${b.to}:${b.specifier}`));
}

export function sortEdges(edges: ExpectedEdge[]): ExpectedEdge[] {
  return [...edges].sort((a, b) =>
    `${a.from}:${a.to}:${a.specifier}`.localeCompare(`${b.from}:${b.to}:${b.specifier}`),
  );
}
