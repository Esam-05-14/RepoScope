import type { AnalysisSnapshot } from "@reposcope/contracts";
import { SnapshotValidationError, validateAnalysisSnapshot } from "@reposcope/contracts";

const ABSOLUTE = /([A-Za-z]:[\\/]|\\\\|\/\/)/;

export function exportSnapshot(snapshot: AnalysisSnapshot): AnalysisSnapshot {
  const exported: AnalysisSnapshot = {
    schemaVersion: snapshot.schemaVersion,
    engineVersion: snapshot.engineVersion,
    parserVersion: snapshot.parserVersion,
    scanId: snapshot.scanId,
    scope: { ...snapshot.scope, limits: { ...snapshot.scope.limits } },
    projectContexts: snapshot.projectContexts?.map((context) => ({ ...context })),
    nodes: snapshot.nodes.map((node) => ({ ...node })),
    observations: snapshot.observations.map((observation) => ({
      ...observation,
      range: { ...observation.range },
      resolution: { ...observation.resolution },
    })),
    semanticEdges: snapshot.semanticEdges.map((edge) => ({
      ...edge,
      observationIds: [...edge.observationIds],
    })),
    coverage: {
      ...snapshot.coverage,
      constructCounts: { ...snapshot.coverage.constructCounts },
      truncations: [...snapshot.coverage.truncations],
    },
    graphDigest: snapshot.graphDigest,
    contentManifestDigest: snapshot.contentManifestDigest,
  };
  validateAnalysisSnapshot(exported);
  const serialized = JSON.stringify(exported);
  if (ABSOLUTE.test(serialized) || serialized.includes("sourceText")) {
    throw new SnapshotValidationError("export is not source-free");
  }
  return exported;
}

export function importSnapshot(value: unknown): AnalysisSnapshot {
  if (value === null || typeof value !== "object") {
    throw new SnapshotValidationError("snapshot must be an object");
  }
  if ("sourceText" in value) {
    throw new SnapshotValidationError("source text is not allowed");
  }
  const snapshot = value as AnalysisSnapshot;
  validateAnalysisSnapshot(snapshot);
  return exportSnapshot(snapshot);
}
