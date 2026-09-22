import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnalysisSnapshot } from "@reposcope/contracts";
import { exportSnapshot, importSnapshot } from "./export.js";

const IDENTITY = /^[A-Za-z0-9:_-]{1,128}$/;
const SNAPSHOT_ID = /^[A-Za-z0-9._-]{1,128}$/;

export interface PersistedSnapshotRef {
  id: string;
  label: string;
  graphDigest: string;
}

export function repositoryIdentityForRoot(root: string): string {
  const digest = createHash("sha256").update(path.resolve(root), "utf8").digest("hex");
  return `repo:${digest.slice(0, 16)}`;
}

export function defaultStoreRoot(): string {
  if (process.env.REPOSCOPE_CACHE !== undefined && process.env.REPOSCOPE_CACHE !== "") {
    return path.join(process.env.REPOSCOPE_CACHE, "store");
  }
  return path.join(os.homedir(), ".reposcope", "store");
}

function confineUnder(root: string, candidate: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    return null;
  }
  return resolved;
}

function identityDir(storeRoot: string, identity: string): string | null {
  if (!IDENTITY.test(identity)) {
    return null;
  }
  return confineUnder(storeRoot, path.join(storeRoot, identity.replaceAll(":", "_")));
}

function snapshotPath(storeRoot: string, identity: string, id: string): string | null {
  if (!SNAPSHOT_ID.test(id)) {
    return null;
  }
  const directory = identityDir(storeRoot, identity);
  if (directory === null) {
    return null;
  }
  return confineUnder(directory, path.join(directory, `${id}.json`));
}

export function snapshotLabel(snapshot: AnalysisSnapshot): string {
  const commit = snapshot.scope.selectedCommit;
  const scope =
    commit !== undefined && commit !== ""
      ? `${snapshot.scope.kind}@${commit.slice(0, 7)}`
      : snapshot.scope.kind;
  return `${scope} · ${snapshot.nodes.length} files`;
}

export function persistSnapshot(
  storeRoot: string,
  identity: string,
  id: string,
  snapshot: AnalysisSnapshot,
): void {
  const dest = snapshotPath(storeRoot, identity, id);
  if (dest === null) {
    throw new Error("persist path is not inside the application store");
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, `${JSON.stringify(exportSnapshot(snapshot), null, 2)}\n`, "utf8");
  prunePersistedSnapshots(storeRoot, identity, 20);
}

export function prunePersistedSnapshots(
  storeRoot: string,
  identity: string,
  keep: number,
): void {
  const directory = identityDir(storeRoot, identity);
  if (directory === null || !existsSync(directory)) {
    return;
  }
  const files: { dest: string; mtimeMs: number }[] = [];
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const dest = snapshotPath(storeRoot, identity, name.slice(0, -".json".length));
    if (dest === null) {
      continue;
    }
    try {
      const stat = lstatSync(dest);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        continue;
      }
      files.push({ dest, mtimeMs: stat.mtimeMs });
    } catch {
      continue;
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const extra of files.slice(keep)) {
    rmSync(extra.dest, { force: true });
  }
}

export function loadPersistedSnapshots(
  storeRoot: string,
  identity: string,
): { id: string; snapshot: AnalysisSnapshot }[] {
  const directory = identityDir(storeRoot, identity);
  if (directory === null || !existsSync(directory)) {
    return [];
  }
  try {
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return [];
    }
  } catch {
    return [];
  }
  const loaded: { id: string; snapshot: AnalysisSnapshot }[] = [];
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const id = name.slice(0, -".json".length);
    const dest = snapshotPath(storeRoot, identity, id);
    if (dest === null) {
      continue;
    }
    try {
      const stat = lstatSync(dest);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        continue;
      }
      const snapshot = importSnapshot(JSON.parse(readFileSync(dest, "utf8")));
      loaded.push({ id, snapshot });
    } catch {
      continue;
    }
  }
  return loaded;
}

export function listPersistedSnapshots(
  storeRoot: string,
  identity: string,
): PersistedSnapshotRef[] {
  return loadPersistedSnapshots(storeRoot, identity).map((item) => ({
    id: item.id,
    label: snapshotLabel(item.snapshot),
    graphDigest: item.snapshot.graphDigest,
  }));
}

export function clearPersistedSnapshots(storeRoot: string, identity: string): void {
  const directory = identityDir(storeRoot, identity);
  if (directory === null || !existsSync(directory)) {
    return;
  }
  rmSync(directory, { recursive: true, force: true });
}
