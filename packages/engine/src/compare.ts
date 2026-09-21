import {
  SCHEMA_VERSION,
  type AnalysisSnapshot,
  type SnapshotComparison,
} from "@reposcope/contracts";
import { cycleGroupsFromSnapshot } from "./analyze.js";

function schemaMajor(version: string): string {
  return version.split(".")[0] ?? "";
}

function cycleKey(members: readonly string[]): string {
  return [...members].sort().join("\0");
}

function blockedComparison(
  base: AnalysisSnapshot,
  target: AnalysisSnapshot,
  reasons: string[],
): SnapshotComparison {
  return {
    schemaVersion: SCHEMA_VERSION,
    baseDigest: base.graphDigest,
    targetDigest: target.graphDigest,
    compatibility: { status: "blocked", reasons },
    addedNodes: [],
    removedNodes: [],
    changedNodes: [],
    addedEdges: [],
    removedEdges: [],
    changedEdges: [],
    addedCycleGroups: [],
    removedCycleGroups: [],
    coverageDelta: {},
  };
}

export function compareSnapshots(
  base: AnalysisSnapshot,
  target: AnalysisSnapshot,
): SnapshotComparison {
  const reasons: string[] = [];
  if (schemaMajor(base.schemaVersion) !== schemaMajor(target.schemaVersion)) {
    reasons.push("schema-major-mismatch");
  }
  if (base.parserVersion !== target.parserVersion) {
    reasons.push("parser-mismatch");
  }
  if (base.scope.edgePolicy !== target.scope.edgePolicy) {
    reasons.push("edge-policy-mismatch");
  }
  if (reasons.length > 0) {
    return blockedComparison(base, target, reasons);
  }

  if (base.scope.kind !== target.scope.kind) {
    reasons.push("scope-kind-mismatch");
  }
  if (base.engineVersion !== target.engineVersion) {
    reasons.push("engine-version-mismatch");
  }
  if (base.scope.repositoryIdentity !== target.scope.repositoryIdentity) {
    reasons.push("repository-identity-mismatch");
  }

  const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
  const targetNodes = new Map(target.nodes.map((node) => [node.id, node]));
  const addedNodes: string[] = [];
  const removedNodes: string[] = [];
  const changedNodes: SnapshotComparison["changedNodes"] = [];

  for (const id of targetNodes.keys()) {
    if (!baseNodes.has(id)) {
      addedNodes.push(id);
    }
  }
  for (const id of baseNodes.keys()) {
    if (!targetNodes.has(id)) {
      removedNodes.push(id);
    }
  }
  for (const [id, targetNode] of targetNodes) {
    const baseNode = baseNodes.get(id);
    if (baseNode === undefined) {
      continue;
    }
    if (baseNode.contentHash !== targetNode.contentHash) {
      changedNodes.push({ id, change: "content" });
      continue;
    }
    if (baseNode.parseStatus !== targetNode.parseStatus) {
      changedNodes.push({ id, change: "parse-status" });
      continue;
    }
    if (baseNode.projectContextId !== targetNode.projectContextId) {
      changedNodes.push({ id, change: "context" });
    }
  }

  const baseEdges = new Map(base.semanticEdges.map((edge) => [edge.key, edge]));
  const targetEdges = new Map(target.semanticEdges.map((edge) => [edge.key, edge]));
  const addedEdges: string[] = [];
  const removedEdges: string[] = [];
  const changedEdges: SnapshotComparison["changedEdges"] = [];

  for (const key of targetEdges.keys()) {
    if (!baseEdges.has(key)) {
      addedEdges.push(key);
    }
  }
  for (const key of baseEdges.keys()) {
    if (!targetEdges.has(key)) {
      removedEdges.push(key);
    }
  }
  for (const [key, targetEdge] of targetEdges) {
    const baseEdge = baseEdges.get(key);
    if (baseEdge === undefined) {
      continue;
    }
    const baseIds = [...baseEdge.observationIds].sort().join(",");
    const targetIds = [...targetEdge.observationIds].sort().join(",");
    if (baseIds !== targetIds) {
      changedEdges.push({ key, change: "evidence-only" });
    }
  }

  const baseCycles = new Map(
    cycleGroupsFromSnapshot(base).map((group) => [cycleKey(group.members), [...group.members]]),
  );
  const targetCycles = new Map(
    cycleGroupsFromSnapshot(target).map((group) => [cycleKey(group.members), [...group.members]]),
  );
  const addedCycleGroups: string[][] = [];
  const removedCycleGroups: string[][] = [];
  for (const [key, members] of targetCycles) {
    if (!baseCycles.has(key)) {
      addedCycleGroups.push(members);
    }
  }
  for (const [key, members] of baseCycles) {
    if (!targetCycles.has(key)) {
      removedCycleGroups.push(members);
    }
  }

  addedNodes.sort();
  removedNodes.sort();
  changedNodes.sort((a, b) => a.id.localeCompare(b.id));
  addedEdges.sort();
  removedEdges.sort();
  changedEdges.sort((a, b) => a.key.localeCompare(b.key));
  addedCycleGroups.sort((a, b) => cycleKey(a).localeCompare(cycleKey(b)));
  removedCycleGroups.sort((a, b) => cycleKey(a).localeCompare(cycleKey(b)));

  return {
    schemaVersion: SCHEMA_VERSION,
    baseDigest: base.graphDigest,
    targetDigest: target.graphDigest,
    compatibility: {
      status: reasons.length > 0 ? "warning" : "compatible",
      reasons,
    },
    addedNodes,
    removedNodes,
    changedNodes,
    addedEdges,
    removedEdges,
    changedEdges,
    addedCycleGroups,
    removedCycleGroups,
    coverageDelta: {
      discoveredFiles: target.coverage.discoveredFiles - base.coverage.discoveredFiles,
      analyzedFiles: target.coverage.analyzedFiles - base.coverage.analyzedFiles,
      unresolved:
        target.coverage.constructCounts.unresolved - base.coverage.constructCounts.unresolved,
      unsupported:
        target.coverage.constructCounts.unsupported - base.coverage.constructCounts.unsupported,
    },
  };
}

export function isEmptyComparison(comparison: SnapshotComparison): boolean {
  return (
    comparison.addedNodes.length === 0 &&
    comparison.removedNodes.length === 0 &&
    comparison.changedNodes.length === 0 &&
    comparison.addedEdges.length === 0 &&
    comparison.removedEdges.length === 0 &&
    comparison.changedEdges.length === 0 &&
    comparison.addedCycleGroups.length === 0 &&
    comparison.removedCycleGroups.length === 0 &&
    (comparison.coverageDelta.discoveredFiles ?? 0) === 0 &&
    (comparison.coverageDelta.analyzedFiles ?? 0) === 0 &&
    (comparison.coverageDelta.unresolved ?? 0) === 0 &&
    (comparison.coverageDelta.unsupported ?? 0) === 0
  );
}

export function emptySelfComparison(snapshot: AnalysisSnapshot): boolean {
  return isEmptyComparison(compareSnapshots(snapshot, snapshot));
}
