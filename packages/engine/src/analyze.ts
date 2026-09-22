import type { AnalysisSnapshot, EdgePolicy } from "@reposcope/contracts";
import {
  buildAdjacency,
  buildComponentRelations,
  fileRelationView,
  reverseImpact,
  shortestObservedPath,
  stronglyConnectedComponents,
  type ComponentRelationGraph,
  type DirectedEdge,
  type FileRelationView,
  type ReverseImpact,
  type ReverseImpactOptions,
} from "@reposcope/graph";

function relationInput(snapshot: AnalysisSnapshot) {
  return {
    files: snapshot.nodes.map((node) => ({ id: node.id })),
    edges: snapshot.semanticEdges.map((edge) => ({
      importerId: edge.importerId,
      targetId: edge.targetId,
      edgeClass: edge.edgeClass,
      syntaxClass: edge.syntaxClass,
    })),
    observations: snapshot.observations.map((item) => ({
      importerId: item.importerId,
      syntaxKind: item.syntaxKind,
      status: item.resolution.status,
      targetId: item.resolution.targetId,
    })),
    policy: snapshot.scope.edgePolicy,
    workspacePackages: snapshot.coverage.workspacePackages,
  };
}

export function relationsFromSnapshot(snapshot: AnalysisSnapshot): ComponentRelationGraph {
  return buildComponentRelations(relationInput(snapshot));
}

export function fileRelationsFromSnapshot(
  snapshot: AnalysisSnapshot,
  fileId: string,
): FileRelationView | undefined {
  return fileRelationView({ ...relationInput(snapshot), fileId });
}

export function directedEdgesFromSnapshot(
  snapshot: AnalysisSnapshot,
): DirectedEdge[] {
  const edges: DirectedEdge[] = [];
  for (const edge of snapshot.semanticEdges) {
    if (edge.targetId === undefined) {
      continue;
    }
    edges.push({
      from: edge.importerId,
      to: edge.targetId,
      edgeClass: edge.edgeClass,
    });
  }
  return edges;
}

export function graphFromSnapshot(
  snapshot: AnalysisSnapshot,
  policy?: EdgePolicy,
) {
  return buildAdjacency(
    snapshot.nodes.map((node) => node.id),
    directedEdgesFromSnapshot(snapshot),
    policy ?? snapshot.scope.edgePolicy,
  );
}

export function impactFromSnapshot(
  snapshot: AnalysisSnapshot,
  origin: string,
  options?: ReverseImpactOptions & { policy?: EdgePolicy },
): ReverseImpact & { shortestPathFrom: (importer: string) => string[] | undefined } {
  const { reverse } = graphFromSnapshot(snapshot, options?.policy);
  const impact = reverseImpact(origin, reverse, options);
  return {
    ...impact,
    shortestPathFrom(importer: string) {
      return shortestObservedPath(origin, importer, impact.predecessor);
    },
  };
}

export function cycleGroupsFromSnapshot(
  snapshot: AnalysisSnapshot,
  policy?: EdgePolicy,
) {
  const { forward } = graphFromSnapshot(snapshot, policy);
  return stronglyConnectedComponents(forward);
}
