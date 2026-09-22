import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanRepository } from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("richer workspace resolution", () => {
  it("selects the listing tsconfig so a parent paths alias resolves", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "workspace-files"),
    });
    const observation = snapshot.observations.find(
      (item) => item.importerId === "packages/app/src/index.ts",
    );
    expect(observation?.resolution).toMatchObject({
      status: "internal",
      targetId: "packages/lib/src/index.ts",
      contextId: "ctx:tsconfig.json",
    });
    expect(observation?.importedNames).toEqual(["n"]);
  });

  it("loads project references and resolves a relative package import", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "project-references"),
    });
    expect(snapshot.projectContexts?.map((context) => context.configPath)).toEqual(
      expect.arrayContaining([
        "tsconfig.json",
        "packages/app/tsconfig.json",
        "packages/lib/tsconfig.json",
      ]),
    );
    const observation = snapshot.observations.find(
      (item) => item.importerId === "packages/app/src/index.ts",
    );
    expect(observation?.resolution).toMatchObject({
      status: "internal",
      targetId: "packages/lib/src/util.ts",
    });
  });
});

describe("workspace package names", () => {
  it("resolves a workspace package name and subpath without tsconfig paths", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "workspace-names"),
    });
    const root = snapshot.observations.find(
      (item) =>
        item.importerId === "packages/app/src/index.ts" && item.specifier === "@demo/named-lib",
    );
    const extra = snapshot.observations.find(
      (item) =>
        item.importerId === "packages/app/src/index.ts" && item.specifier === "@demo/named-lib/extra",
    );
    expect(root?.resolution).toMatchObject({
      status: "internal",
      targetId: "packages/lib/src/index.ts",
      reasonCode: "WORKSPACE_PACKAGE",
    });
    expect(extra?.resolution).toMatchObject({
      status: "internal",
      targetId: "packages/lib/src/extra.ts",
      reasonCode: "WORKSPACE_PACKAGE",
    });
    expect(
      snapshot.semanticEdges.some(
        (edge) =>
          edge.importerId === "packages/app/src/index.ts" && edge.targetId === "packages/lib/src/index.ts",
      ),
    ).toBe(true);
  });
});

describe("CommonJS require extraction", () => {
  it("treats a string require as a supported observed dependency", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "cjs-require"),
    });
    const observation = snapshot.observations.find((item) => item.syntaxKind === "require");
    expect(observation).toMatchObject({
      importerId: "src/a.cjs",
      specifier: "./b.cjs",
      syntaxKind: "require",
      resolution: {
        status: "internal",
        targetId: "src/b.cjs",
      },
    });
    expect(snapshot.semanticEdges.some((edge) => edge.importerId === "src/a.cjs" && edge.targetId === "src/b.cjs")).toBe(
      true,
    );
  });
});

describe("declared binding names", () => {
  it("records import names without treating them as usage", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    const money = snapshot.observations.find(
      (item) => item.importerId === "src/app.ts" && item.specifier === "./lib/money.js",
    );
    expect(money?.importedNames).toEqual(["formatCents"]);
    const edge = snapshot.semanticEdges.find(
      (item) => item.importerId === "src/app.ts" && item.targetId === "src/lib/money.ts",
    );
    expect(edge?.importedNames).toEqual(["formatCents"]);
  });
});
