import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { AnalysisSnapshot, ScanProgressResponse } from "@reposcope/contracts";
import {
  cancelScan,
  fetchSnapshot,
  fetchSnapshotCatalog,
  startScan,
  waitForScan,
} from "./lib/api.js";

export interface SnapshotRef {
  id: string;
  label: string;
}

interface WorkspaceValue {
  snapshotId?: string;
  snapshot?: AnalysisSnapshot;
  catalog: SnapshotRef[];
  activeScanId?: string;
  scanProgress?: ScanProgressResponse;
  remember: (ref: SnapshotRef, snapshot: AnalysisSnapshot, select?: boolean) => void;
  select: (id: string) => Promise<void>;
  runScan: (body: Record<string, unknown>, label: string) => Promise<string>;
  cancelActiveScan: () => Promise<void>;
  reset: () => void;
}

const Workspace = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider(props: { children: ReactNode }): ReactElement {
  const [snapshotId, setSnapshotId] = useState<string>();
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot>();
  const [catalog, setCatalog] = useState<SnapshotRef[]>([]);
  const [activeScanId, setActiveScanId] = useState<string>();
  const [scanProgress, setScanProgress] = useState<ScanProgressResponse>();

  const remember = useCallback(
    (ref: SnapshotRef, next: AnalysisSnapshot, select = true) => {
      setCatalog((current) => {
        if (current.some((item) => item.id === ref.id)) {
          return current;
        }
        return [...current, ref];
      });
      if (select) {
        setSnapshotId(ref.id);
        setSnapshot(next);
      }
    },
    [],
  );

  const select = useCallback(async (id: string) => {
    const next = await fetchSnapshot(id);
    setSnapshotId(id);
    setSnapshot(next);
  }, []);

  useEffect(() => {
    void fetchSnapshotCatalog()
      .then(async (body) => {
        if (body.items.length === 0) {
          return;
        }
        setCatalog(body.items.map((item) => ({ id: item.id, label: item.label })));
        const first = body.items[0];
        if (first !== undefined) {
          const next = await fetchSnapshot(first.id);
          setSnapshotId(first.id);
          setSnapshot(next);
        }
      })
      .catch(() => {
        // Session may have no persisted snapshots yet.
      });
  }, []);

  const runScan = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      const started = await startScan(body);
      setActiveScanId(started.id);
      setScanProgress({ id: started.id, status: started.status, phase: "inventory" });
      try {
        const done = await waitForScan(started.id, 180_000, setScanProgress);
        if (done.snapshotId === undefined) {
          throw new Error(done.message ?? `scan ${done.status}`);
        }
        const next = await fetchSnapshot(done.snapshotId);
        remember({ id: done.snapshotId, label }, next, true);
        window.dispatchEvent(new Event("reposcope:scanned"));
        return done.snapshotId;
      } finally {
        setActiveScanId(undefined);
        setScanProgress(undefined);
      }
    },
    [remember],
  );

  const cancelActiveScan = useCallback(async () => {
    if (activeScanId === undefined) {
      return;
    }
    await cancelScan(activeScanId);
  }, [activeScanId]);

  const reset = useCallback(() => {
    setSnapshotId(undefined);
    setSnapshot(undefined);
    setCatalog([]);
    setActiveScanId(undefined);
    setScanProgress(undefined);
  }, []);

  const value = useMemo(
    () => ({
      snapshotId,
      snapshot,
      catalog,
      activeScanId,
      scanProgress,
      remember,
      select,
      runScan,
      cancelActiveScan,
      reset,
    }),
    [
      snapshotId,
      snapshot,
      catalog,
      activeScanId,
      scanProgress,
      remember,
      select,
      runScan,
      cancelActiveScan,
      reset,
    ],
  );

  return <Workspace.Provider value={value}>{props.children}</Workspace.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(Workspace);
  if (value === null) {
    throw new Error("workspace missing");
  }
  return value;
}
