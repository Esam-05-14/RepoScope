import type { AnalysisSnapshot, EdgePolicy } from "@reposcope/contracts";
import {
  buildAdjacency,
  reverseImpact,
  shortestObservedPath,
  stronglyConnectedComponents,
  type DirectedEdge,
  type ReverseImpact,
  type ReverseImpactOptions,
} from "@reposcope/graph";

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
