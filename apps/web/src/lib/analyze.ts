import type { AnalysisSnapshot, EdgePolicy } from "@reposcope/contracts";
import {
  buildAdjacency,
  reverseImpact,
  shortestObservedPath,
  stronglyConnectedComponents,
  type ReverseImpact,
} from "@reposcope/graph";

export function graphFromSnapshot(snapshot: AnalysisSnapshot, policy?: EdgePolicy) {
  const edges = snapshot.semanticEdges.flatMap((edge) => {
    if (edge.targetId === undefined) {
      return [];
    }
    return [{ from: edge.importerId, to: edge.targetId, edgeClass: edge.edgeClass }];
  });
  return buildAdjacency(
    snapshot.nodes.map((node) => node.id),
    edges,
    policy ?? snapshot.scope.edgePolicy,
  );
}

export function impactFromSnapshot(
  snapshot: AnalysisSnapshot,
  origin: string,
): ReverseImpact & { shortestPathFrom: (importer: string) => string[] | undefined } {
  const { reverse } = graphFromSnapshot(snapshot);
  const impact = reverseImpact(origin, reverse);
  return {
    ...impact,
    shortestPathFrom(importer: string) {
      return shortestObservedPath(origin, importer, impact.predecessor);
    },
  };
}

export function cycleGroupsFromSnapshot(snapshot: AnalysisSnapshot) {
  const { forward } = graphFromSnapshot(snapshot);
  return stronglyConnectedComponents(forward);
}
