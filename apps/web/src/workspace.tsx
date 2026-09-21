import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { AnalysisSnapshot } from "@reposcope/contracts";
import { fetchSnapshot, startScan, waitForScan } from "./lib/api.js";

export interface SnapshotRef {
  id: string;
  label: string;
}

interface WorkspaceValue {
  snapshotId?: string;
  snapshot?: AnalysisSnapshot;
  catalog: SnapshotRef[];
  remember: (ref: SnapshotRef, snapshot: AnalysisSnapshot, select?: boolean) => void;
  select: (id: string) => Promise<void>;
  runScan: (body: Record<string, unknown>, label: string) => Promise<string>;
}

const Workspace = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider(props: { children: ReactNode }): ReactElement {
  const [snapshotId, setSnapshotId] = useState<string>();
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot>();
  const [catalog, setCatalog] = useState<SnapshotRef[]>([]);

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

  const runScan = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      const started = await startScan(body);
      const done = await waitForScan(started.id);
      if (done.snapshotId === undefined) {
        throw new Error(done.message ?? `scan ${done.status}`);
      }
      const next = await fetchSnapshot(done.snapshotId);
      remember({ id: done.snapshotId, label }, next, true);
      window.dispatchEvent(new Event("reposcope:scanned"));
      return done.snapshotId;
    },
    [remember],
  );

  const value = useMemo(
    () => ({ snapshotId, snapshot, catalog, remember, select, runScan }),
    [snapshotId, snapshot, catalog, remember, select, runScan],
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
