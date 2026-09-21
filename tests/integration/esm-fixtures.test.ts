import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanRepository } from "@reposcope/engine";
import { sortEdges, valueEdgesFrom } from "../helpers/snapshot-shape.ts";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

function loadExpected(name: string): {
  files: string[];
  supportedInternalObservations: number;
  valueEdges: {
    from: string;
    to: string;
    specifier: string;
    syntaxKind: string;
    edgeClass: string;
  }[];
  coverage: {
    discoveredSourceFiles: number;
    analyzedFiles: number;
    skippedFiles: number;
    parseFailures: number;
    constructCounts: Record<string, number>;
  };
} {
  return JSON.parse(
    readFileSync(path.join(root, "fixtures", "expected", `${name}.json`), "utf8"),
  ) as ReturnType<typeof loadExpected>;
}

describe("public fixture scans", () => {
  it("matches esm-baseline expected sets", () => {
    const expected = loadExpected("esm-baseline");
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "esm-baseline"),
    });
    expect(snapshot.nodes.map((node) => node.id)).toEqual(expected.files);
    expect(snapshot.coverage.discoveredFiles).toBe(expected.coverage.discoveredSourceFiles);
    expect(snapshot.coverage.analyzedFiles).toBe(expected.coverage.analyzedFiles);
    expect(snapshot.coverage.skippedFiles).toBe(expected.coverage.skippedFiles);
    expect(snapshot.coverage.parseFailures).toBe(expected.coverage.parseFailures);
    expect(snapshot.coverage.constructCounts).toEqual(expected.coverage.constructCounts);
    expect(valueEdgesFrom(snapshot)).toEqual(sortEdges(expected.valueEdges));
    expect(
      snapshot.observations.filter((observation) => observation.resolution.status === "internal"),
    ).toHaveLength(expected.supportedInternalObservations);
    expect(JSON.stringify(snapshot)).not.toMatch(/[A-Za-z]:\\/);
    expect(snapshot).not.toHaveProperty("sourceText");
  });

  it("matches esm-revised expected sets", () => {
    const expected = loadExpected("esm-revised");
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "esm-revised"),
    });
    expect(valueEdgesFrom(snapshot)).toEqual(sortEdges(expected.valueEdges));
    expect(
      snapshot.observations.filter((observation) => observation.resolution.status === "internal"),
    ).toHaveLength(expected.supportedInternalObservations);
    expect(snapshot.coverage.constructCounts.internal).toBe(6);
  });

  it("keeps the unresolved import visible", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "unresolved-import"),
    });
    expect(snapshot.nodes.map((node) => node.id)).toEqual(["src/index.ts"]);
    expect(snapshot.observations).toHaveLength(1);
    expect(snapshot.observations[0]).toMatchObject({
      specifier: "./does-not-exist.js",
      syntaxKind: "static-import",
      resolution: {
        status: "unresolved",
        reasonCode: "UNRESOLVED_MODULE",
      },
    });
    expect(snapshot.coverage.constructCounts.unresolved).toBe(1);
    expect(snapshot.coverage.constructCounts.internal).toBe(0);
  });
});
