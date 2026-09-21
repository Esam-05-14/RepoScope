import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareSnapshots, isEmptyComparison, scanRepository } from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("snapshot compare", () => {
  it("is empty when a snapshot is compared to itself", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    const comparison = compareSnapshots(snapshot, snapshot);
    expect(isEmptyComparison(comparison)).toBe(true);
    expect(comparison.compatibility.status).toBe("compatible");
    expect(comparison.addedEdges).toEqual([]);
    expect(comparison.changedNodes).toEqual([]);
    expect(comparison.addedCycleGroups).toEqual([]);
    expect(comparison.removedCycleGroups).toEqual([]);
  });

  it("matches the revised fixture semantic diff", () => {
    const base = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    const target = scanRepository({
      root: path.join(workspace, "fixtures", "esm-revised"),
    });
    const comparison = compareSnapshots(base, target);
    expect(comparison.compatibility.status).toBe("warning");
    expect(comparison.compatibility.reasons).toContain("repository-identity-mismatch");
    expect(comparison.changedNodes).toEqual([{ id: "src/lib/money.ts", change: "content" }]);
    expect(comparison.addedEdges).toEqual([
      "src/lib/money.ts>|internal:src/main.ts|static-import|value",
    ]);
    expect(comparison.removedEdges).toEqual([]);
    expect(comparison.addedCycleGroups).toEqual([
      ["src/app.ts", "src/cycle-a.ts", "src/cycle-b.ts", "src/lib/money.ts", "src/main.ts"],
    ]);
    expect(comparison.removedCycleGroups).toEqual([
      ["src/app.ts", "src/cycle-a.ts", "src/cycle-b.ts"],
    ]);
    expect(comparison.coverageDelta).toEqual({
      discoveredFiles: 0,
      analyzedFiles: 0,
      unresolved: 0,
      unsupported: 0,
    });
  });

  it("blocks incompatible parser or edge-policy pairs", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    const blocked = compareSnapshots(snapshot, {
      ...snapshot,
      parserVersion: "typescript@5.0.0",
      scope: { ...snapshot.scope, edgePolicy: "include-type-only" },
    });
    expect(blocked.compatibility.status).toBe("blocked");
    expect(blocked.addedEdges).toEqual([]);
    expect(blocked.changedNodes).toEqual([]);
  });
});
