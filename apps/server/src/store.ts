import { randomBytes } from "node:crypto";
import type { AnalysisSnapshot, ScanStatus } from "@reposcope/contracts";
import type { ScanProgress } from "@reposcope/engine";

export interface StoredSnapshot {
  id: string;
  snapshot: AnalysisSnapshot;
  readRoot: string | null;
  commit?: string;
}

export interface ScanRecord {
  id: string;
  status: ScanStatus;
  snapshotId?: string;
  phase?: ScanProgress["phase"];
  discoveredFiles?: number;
  analyzedFiles?: number;
  message?: string;
  canceled: boolean;
}

export interface AnalysisStore {
  scans: Map<string, ScanRecord>;
  snapshots: Map<string, StoredSnapshot>;
  activeScanId: string | null;
}

export function createAnalysisStore(): AnalysisStore {
  return {
    scans: new Map(),
    snapshots: new Map(),
    activeScanId: null,
  };
}

export function createOpaqueId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}
