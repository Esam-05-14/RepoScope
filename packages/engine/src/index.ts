import { type ScanStatus } from "@reposcope/contracts";
import { emptyAdjacency } from "@reposcope/graph";

export {
  scanRepository,
  scanRepositoryDetailed,
  ScanCanceledError,
  repositoryIdentityForRoot,
  type ScanOptions,
  type ScanProgress,
  type ScanResult,
} from "./scan.js";
export {
  persistSnapshot,
  loadPersistedSnapshots,
  listPersistedSnapshots,
  prunePersistedSnapshots,
  clearPersistedSnapshots,
  defaultStoreRoot,
  snapshotLabel,
  type PersistedSnapshotRef,
} from "./persist.js";
export {
  cycleGroupsFromSnapshot,
  directedEdgesFromSnapshot,
  fileRelationsFromSnapshot,
  graphFromSnapshot,
  impactFromSnapshot,
  relationsFromSnapshot,
} from "./analyze.js";
export { investigationBriefFromSnapshot, investigationBriefMarkdown } from "./brief.js";
export { graphDigestOf, contentManifestDigestOf } from "./digest.js";
export { ConfinedFilesystemHost } from "./filesystem/confined-fs.js";
export { inventoryRepository, DEFAULT_LIMITS } from "./filesystem/inventory.js";
export { isInsideRoot } from "./filesystem/paths.js";
export { readEvidence, hashBytes, EVIDENCE_SLICE_LIMIT, type EvidenceSlice } from "./evidence.js";
export { compareSnapshots, isEmptyComparison } from "./compare.js";
export { exportSnapshot, importSnapshot } from "./export.js";
export { GitObjectFilesystemHost } from "./git/host.js";
export { GitAdapterError, assertSafeGitRev, resolveCommit } from "./git/exec.js";
export {
  cloneGitHubRepository,
  defaultGitHubCacheRoot,
  looksLikeGitHubInput,
  parseGitHubRepoInput,
  pruneGitHubCache,
  clearGitHubCache,
  type ClonedGitHubRepo,
  type GitHubRepoRef,
} from "./git/github.js";
export {
  evaluateBoundaryPolicy,
  groupsForPath,
  type BoundaryPolicy,
  type BoundaryViolation,
} from "./boundaries.js";
export type { AnalysisFilesystemHost } from "./filesystem/host.js";

export function initialScanStatus(): ScanStatus {
  return "idle";
}

export function emptyGraphPlaceholder(): ReturnType<typeof emptyAdjacency> {
  return emptyAdjacency();
}
