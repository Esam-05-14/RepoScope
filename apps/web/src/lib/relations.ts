import type { AnalysisSnapshot } from "@reposcope/contracts";
import {
  buildComponentRelations,
  fileRelationView,
  type ComponentRelationGraph,
  type FileRelationView,
} from "@reposcope/graph";

function inputFromSnapshot(snapshot: AnalysisSnapshot) {
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
  return buildComponentRelations(inputFromSnapshot(snapshot));
}

export function fileRelationsFromSnapshot(
  snapshot: AnalysisSnapshot,
  fileId: string,
): FileRelationView | undefined {
  return fileRelationView({ ...inputFromSnapshot(snapshot), fileId });
}
