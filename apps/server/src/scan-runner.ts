import {
  GitObjectFilesystemHost,
  scanRepositoryDetailed,
  type ScanProgress,
} from "@reposcope/engine";
import type { EdgePolicy } from "@reposcope/contracts";
import type { Session } from "./session.js";
import {
  createOpaqueId,
  type AnalysisStore,
  type ScanRecord,
} from "./store.js";

export interface ScanRequest {
  fixture?: string;
  commit?: string;
  edgePolicy?: EdgePolicy;
}

export interface ScanRunnerOptions {
  delayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveRoot(session: Session, fixture: string | undefined): string | null {
  if (fixture !== undefined) {
    const mapped = session.fixtureCatalog[fixture];
    return mapped ?? null;
  }
  return session.canonicalRoot;
}

export function startScan(
  store: AnalysisStore,
  session: Session,
  request: ScanRequest,
  runner: ScanRunnerOptions,
): { record: ScanRecord; error?: string } {
  if (store.activeScanId !== null) {
    const active = store.scans.get(store.activeScanId);
    if (active !== undefined && active.status === "scanning") {
      return { record: active, error: "busy" };
    }
  }
  const root = resolveRoot(session, request.fixture);
  if (root === null) {
    return {
      record: {
        id: "none",
        status: "failed",
        canceled: false,
        message: "No CLI-selected root is available.",
      },
      error: "no-root",
    };
  }
  const id = createOpaqueId("scan");
  const record: ScanRecord = {
    id,
    status: "scanning",
    canceled: false,
    phase: "inventory",
    discoveredFiles: 0,
    analyzedFiles: 0,
  };
  store.scans.set(id, record);
  store.activeScanId = id;
  session.scanStatus = "scanning";
  void runScan(store, session, record, root, request, runner);
  return { record };
}

async function runScan(
  store: AnalysisStore,
  session: Session,
  record: ScanRecord,
  root: string,
  request: ScanRequest,
  runner: ScanRunnerOptions,
): Promise<void> {
  try {
    if (runner.delayMs !== undefined && runner.delayMs > 0) {
      await sleep(runner.delayMs);
    }
    if (record.canceled) {
      record.status = "canceled";
      session.scanStatus = "canceled";
      if (store.activeScanId === record.id) {
        store.activeScanId = null;
      }
      return;
    }
    const host =
      request.commit === undefined
        ? undefined
        : GitObjectFilesystemHost.open(root, request.commit);
    const result = scanRepositoryDetailed({
      root,
      host,
      edgePolicy: request.edgePolicy,
      scopeKind: request.commit === undefined ? "working-tree" : "git-commit",
      selectedCommit: host?.commit,
      scanId: record.id,
      shouldCancel: () => record.canceled,
      onProgress: (progress: ScanProgress) => {
        record.phase = progress.phase;
        record.discoveredFiles = progress.discoveredFiles;
        record.analyzedFiles = progress.analyzedFiles;
      },
    });
    if (record.canceled || result.canceled || result.snapshot === undefined) {
      record.status = "canceled";
      record.canceled = true;
      session.scanStatus = "canceled";
      return;
    }
    if (record.canceled) {
      record.status = "canceled";
      session.scanStatus = "canceled";
      return;
    }
    const snapshotId = createOpaqueId("snap");
    result.snapshot.scanId = record.id;
    store.snapshots.set(snapshotId, {
      id: snapshotId,
      snapshot: result.snapshot,
      readRoot: root,
      commit: host?.commit,
    });
    record.snapshotId = snapshotId;
    record.status = result.snapshot.scope.truncated === true ? "partial" : "completed";
    record.phase = "graph";
    record.discoveredFiles = result.snapshot.coverage.discoveredFiles;
    record.analyzedFiles = result.snapshot.coverage.analyzedFiles;
    session.scanStatus = record.status;
  } catch (error) {
    record.status = "failed";
    record.message = error instanceof Error ? error.message.slice(0, 200) : "scan failed";
    session.scanStatus = "failed";
  } finally {
    if (store.activeScanId === record.id) {
      store.activeScanId = null;
    }
  }
}

export function cancelScan(
  store: AnalysisStore,
  session: Session,
  id: string,
): ScanRecord | undefined {
  const record = store.scans.get(id);
  if (record === undefined) {
    return undefined;
  }
  if (record.status === "scanning") {
    record.canceled = true;
    record.status = "canceled";
    session.scanStatus = "canceled";
  }
  return record;
}
