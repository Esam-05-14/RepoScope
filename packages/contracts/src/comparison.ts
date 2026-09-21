export type CompatibilityStatus = "compatible" | "warning" | "blocked";

export type NodeChange = "content" | "parse-status" | "context";

export type EdgeChange = "classification" | "resolution" | "evidence-only";

export interface SnapshotComparison {
  schemaVersion: string;
  baseDigest: string;
  targetDigest: string;
  compatibility: {
    status: CompatibilityStatus;
    reasons: string[];
  };
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: { id: string; change: NodeChange }[];
  addedEdges: string[];
  removedEdges: string[];
  changedEdges: { key: string; change: EdgeChange }[];
  addedCycleGroups: string[][];
  removedCycleGroups: string[][];
  coverageDelta: {
    discoveredFiles?: number;
    analyzedFiles?: number;
    unresolved?: number;
    unsupported?: number;
  };
}

export interface EvidenceResponse {
  status: "current" | "stale" | "unavailable";
  observationId: string;
  importerId: string;
  specifier: string;
  expectedHash: string;
  observedHash?: string;
  snippet?: string;
  range?: {
    startOffset: number;
    endOffset: number;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface ScanProgressResponse {
  id: string;
  status: string;
  snapshotId?: string;
  phase?: "inventory" | "parse" | "graph";
  discoveredFiles?: number;
  analyzedFiles?: number;
  message?: string;
}
