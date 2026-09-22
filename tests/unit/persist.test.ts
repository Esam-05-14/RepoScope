import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  clearPersistedSnapshots,
  loadPersistedSnapshots,
  persistSnapshot,
  scanRepository,
} from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("source-free snapshot persistence", () => {
  it("round-trips a snapshot inside the application store", () => {
    const storeRoot = mkdtempSync(path.join(tmpdir(), "reposcope-store-"));
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    persistSnapshot(storeRoot, snapshot.scope.repositoryIdentity, "snap_test1", snapshot);
    const loaded = loadPersistedSnapshots(storeRoot, snapshot.scope.repositoryIdentity);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.snapshot.graphDigest).toBe(snapshot.graphDigest);
    expect(JSON.stringify(loaded[0]?.snapshot)).not.toMatch(/[A-Za-z]:\\/);
    clearPersistedSnapshots(storeRoot, snapshot.scope.repositoryIdentity);
    expect(loadPersistedSnapshots(storeRoot, snapshot.scope.repositoryIdentity)).toEqual([]);
  });

  it("rejects identity traversal", () => {
    const storeRoot = mkdtempSync(path.join(tmpdir(), "reposcope-store-"));
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "unresolved-import"),
    });
    expect(() => {
      persistSnapshot(storeRoot, "../escape", "snap_test1", snapshot);
    }).toThrow(/persist path/);
  });
});
