import type { AnalysisSnapshot } from "./snapshot.js";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ABSOLUTE = /^([A-Za-z]:[\\/]|\\\\|\/)/;

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotValidationError";
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new SnapshotValidationError(message);
  }
}

function rejectAbsolute(value: string, label: string): void {
  assert(!ABSOLUTE.test(value), `${label} must not be an absolute path`);
  assert(!value.includes("\\"), `${label} must use forward slashes`);
}

export function validateAnalysisSnapshot(snapshot: AnalysisSnapshot): void {
  assert(/^1\.\d+\.\d+$/.test(snapshot.schemaVersion), "unknown schema major");
  assert(DIGEST.test(snapshot.graphDigest), "invalid graphDigest");
  assert(DIGEST.test(snapshot.contentManifestDigest), "invalid contentManifestDigest");
  assert(!("sourceText" in snapshot), "source text is not allowed");

  const nodeIds = new Set<string>();
  for (const node of snapshot.nodes) {
    assert(!nodeIds.has(node.id), `duplicate node id ${node.id}`);
    rejectAbsolute(node.id, "node.id");
    rejectAbsolute(node.relativePath, "node.relativePath");
    assert(node.id === node.relativePath, "node id must equal relativePath");
    assert(DIGEST.test(node.contentHash), `invalid contentHash for ${node.id}`);
    nodeIds.add(node.id);
  }

  for (const listed of snapshot.coverage.workspacePackages ?? []) {
    rejectAbsolute(listed.directory, "workspacePackages.directory");
  }

  for (const observation of snapshot.observations) {
    assert(nodeIds.has(observation.importerId), `missing importer ${observation.importerId}`);
    rejectAbsolute(observation.importerId, "observation.importerId");
    assert(observation.range.endOffset >= observation.range.startOffset, "impossible range");
    if (observation.resolution.status === "internal") {
      assert(
        observation.resolution.targetId !== undefined &&
          nodeIds.has(observation.resolution.targetId),
        "internal target must exist",
      );
    }
    if (observation.resolution.targetId !== undefined) {
      rejectAbsolute(observation.resolution.targetId, "resolution.targetId");
    }
  }

  for (const edge of snapshot.semanticEdges) {
    assert(nodeIds.has(edge.importerId), `missing edge importer ${edge.importerId}`);
    if (edge.targetId !== undefined) {
      assert(nodeIds.has(edge.targetId), `missing edge target ${edge.targetId}`);
    }
  }
}
