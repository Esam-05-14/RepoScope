import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cycleGroupsFromSnapshot,
  impactFromSnapshot,
  scanRepository,
} from "@reposcope/engine";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("fixture graph semantics", () => {
  it("traces money.ts importers on esm-baseline", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "esm-baseline"),
    });
    const impact = impactFromSnapshot(snapshot, "src/lib/money.ts");
    expect(impact.directImporters).toEqual(["src/app.ts"]);
    expect(impact.shortestPathFrom("src/main.ts")).toEqual([
      "src/main.ts",
      "src/app.ts",
      "src/lib/money.ts",
    ]);
    expect(impact.directImporters).not.toContain("src/lib/money.ts");
    const cycles = cycleGroupsFromSnapshot(snapshot);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.members).toEqual([
      "src/app.ts",
      "src/cycle-a.ts",
      "src/cycle-b.ts",
    ]);
    expect(cycles[0]?.members).not.toContain("src/lib/money.ts");
  });

  it("hides a type-only cycle under the default edge policy", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "type-only-cycle"),
    });
    expect(snapshot.coverage.constructCounts.typeOnly).toBe(2);
    expect(cycleGroupsFromSnapshot(snapshot)).toEqual([]);
    const withTypes = cycleGroupsFromSnapshot(snapshot, "include-type-only");
    expect(withTypes).toHaveLength(1);
    expect(withTypes[0]?.members).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("keeps duplicate imports as one semantic edge and two observations", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "duplicate-imports"),
    });
    const toB = snapshot.observations.filter(
      (observation) => observation.specifier === "./b.js",
    );
    expect(toB).toHaveLength(2);
    const edges = snapshot.semanticEdges.filter(
      (edge) => edge.targetId === "src/b.ts",
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]?.observationIds).toHaveLength(2);
  });

  it("records a self-import as a cyclic single node", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "self-import"),
    });
    const groups = cycleGroupsFromSnapshot(snapshot);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members).toEqual(["src/loop.ts"]);
  });

  it("scans malformed source without inventing edges", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "malformed-source"),
    });
    expect(snapshot.nodes.map((node) => node.id)).toEqual(["src/broken.ts"]);
    expect(snapshot.nodes[0]?.parseStatus).not.toBe("ok");
    expect(snapshot.semanticEdges).toEqual([]);
  });
});
