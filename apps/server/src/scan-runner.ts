import type { AnalysisSnapshot, EdgePolicy } from "@reposcope/contracts";
import {
  GitObjectFilesystemHost,
  cloneGitHubRepository,
  parseGitHubRepoInput,
  persistSnapshot,
  scanRepositoryDetailed,
  snapshotLabel,
  type ClonedGitHubRepo,
  type GitHubRepoRef,
  type ScanProgress,
} from "@reposcope/engine";
import type { Session } from "./session.js";
import {
  createOpaqueId,
  type AnalysisStore,
  type ScanRecord,
  type StoredSnapshot,
} from "./store.js";

export interface ScanRequest {
  fixture?: string;
  commit?: string;
  edgePolicy?: EdgePolicy;
  github?: string;
  incremental?: boolean;
  previousSnapshotId?: string;
  includeDynamicImport?: boolean;
}

export type CloneGitHub = (input: {
  spec: GitHubRepoRef;
  ref?: string;
}) => Promise<ClonedGitHubRepo>;

export interface ScanRunnerOptions {
  delayMs?: number;
  cloneGitHub?: CloneGitHub;
  persistRoot?: string;
}

function latestSnapshotForRoot(
  store: AnalysisStore,
  root: string,
): StoredSnapshot | undefined {
  let latest: StoredSnapshot | undefined;
  for (const stored of store.snapshots.values()) {
    if (stored.readRoot === root) {
      latest = stored;
    }
  }
  return latest;
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
  if (request.github !== undefined && request.fixture !== undefined) {
    return {
      record: {
        id: "none",
        status: "failed",
        canceled: false,
        message: "github and fixture cannot be combined.",
      },
      error: "no-root",
    };
  }
  const root =
    request.github === undefined ? resolveRoot(session, request.fixture) : "__github__";
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
  initialRoot: string,
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
    let root = initialRoot;
    if (request.github !== undefined) {
      const spec = parseGitHubRepoInput(request.github);
      const clone = runner.cloneGitHub ?? cloneGitHubRepository;
      const cloned = await clone({ spec, ref: request.commit ?? spec.ref });
      root = cloned.root;
      session.rootKind = "github";
      session.rootLabel = cloned.label;
    }
    const host =
      request.github !== undefined || request.commit === undefined
        ? undefined
        : GitObjectFilesystemHost.open(root, request.commit);
    let previousSnapshot: AnalysisSnapshot | undefined;
    if (request.incremental !== false) {
      if (request.previousSnapshotId !== undefined) {
        previousSnapshot = store.snapshots.get(request.previousSnapshotId)?.snapshot;
      } else {
        previousSnapshot = latestSnapshotForRoot(store, root)?.snapshot;
      }
    }
    const result = scanRepositoryDetailed({
      root,
      host,
      edgePolicy: request.edgePolicy,
      scopeKind:
        request.github !== undefined || request.commit === undefined
          ? "working-tree"
          : "git-commit",
      selectedCommit: host?.commit,
      scanId: record.id,
      previousSnapshot,
      includeDynamicImport: request.includeDynamicImport === true,
      shouldCancel: () => record.canceled,
      onProgress: (progress: ScanProgress) => {
        record.phase = progress.phase;
        record.discoveredFiles = progress.discoveredFiles;
        record.analyzedFiles = progress.analyzedFiles;
        record.reusedFiles = progress.reusedFiles;
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
      label: snapshotLabel(result.snapshot),
    });
    if (runner.persistRoot !== undefined) {
      persistSnapshot(
        runner.persistRoot,
        result.snapshot.scope.repositoryIdentity,
        snapshotId,
        result.snapshot,
      );
    }
    record.snapshotId = snapshotId;
    record.status = result.snapshot.scope.truncated === true ? "partial" : "completed";
    record.phase = "graph";
    record.discoveredFiles = result.snapshot.coverage.discoveredFiles;
    record.analyzedFiles = result.snapshot.coverage.analyzedFiles;
    record.reusedFiles = result.snapshot.coverage.reusedFiles;
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
