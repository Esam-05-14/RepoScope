import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { relationsFromSnapshot, scanRepository } from "@reposcope/engine";
import { componentIdForFile } from "@reposcope/graph";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("component relations", () => {
  it("rolls esm-baseline file edges up to directory prefixes", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    const relations = relationsFromSnapshot(snapshot);
    expect(relations.fileComponent["src/lib/money.ts"]).toBe("src/lib");
    expect(relations.fileComponent["src/app.ts"]).toBe("src");
    expect(relations.componentEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "src", to: "src/lib", fileEdges: 1 }),
      ]),
    );
    expect(relations.boundaryFiles).toEqual(
      expect.arrayContaining(["src/app.ts", "src/lib/money.ts"]),
    );
  });

  it("uses workspace package.json names when present", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "project-references"),
    });
    expect(snapshot.coverage.workspacePackages).toEqual(
      expect.arrayContaining([
        { name: "@demo/app", directory: "packages/app" },
        { name: "@demo/lib", directory: "packages/lib" },
      ]),
    );
    const relations = relationsFromSnapshot(snapshot);
    expect(relations.fileComponent["packages/app/src/index.ts"]).toBe("pkg:@demo/app");
    expect(relations.fileComponent["packages/lib/src/util.ts"]).toBe("pkg:@demo/lib");
    expect(relations.componentEdges.some((edge) => edge.from === "pkg:@demo/app" && edge.to === "pkg:@demo/lib")).toBe(
      true,
    );
  });

  it("marks export-from-only files as barrels", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "barrel-file"),
    });
    const relations = relationsFromSnapshot(snapshot);
    expect(relations.barrels).toEqual(["src/index.ts"]);
  });

  it("classifies directory prefixes without treating a filename as a component", () => {
    expect(componentIdForFile("src/app.ts")).toBe("src");
    expect(componentIdForFile("index.ts")).toBe(".");
    expect(componentIdForFile("packages/app/src/index.ts")).toBe("packages/app");
  });
});
