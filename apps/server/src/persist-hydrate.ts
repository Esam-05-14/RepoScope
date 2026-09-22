import {
  loadPersistedSnapshots,
  repositoryIdentityForRoot,
  snapshotLabel,
} from "@reposcope/engine";
import type { Session } from "./session.js";
import type { AnalysisStore } from "./store.js";

export function hydratePersistedSnapshots(
  store: AnalysisStore,
  persistRoot: string,
  session: Session,
): void {
  if (session.canonicalRoot === null) {
    return;
  }
  const identity = repositoryIdentityForRoot(session.canonicalRoot);
  for (const item of loadPersistedSnapshots(persistRoot, identity)) {
    if (store.snapshots.has(item.id)) {
      continue;
    }
    store.snapshots.set(item.id, {
      id: item.id,
      snapshot: item.snapshot,
      readRoot: session.canonicalRoot,
      commit: item.snapshot.scope.selectedCommit,
      label: snapshotLabel(item.snapshot),
    });
  }
}
