import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanRepository } from "@reposcope/engine";
import {
  compilerApiVersion,
  hasCreateSourceFile,
  hasResolveModuleName,
} from "@reposcope/parser-ts";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("S2 compiler resolution", () => {
  it("exposes the TypeScript 6 compiler API", () => {
    expect(compilerApiVersion()).toBe("typescript@6.0.3");
    expect(hasCreateSourceFile()).toBe(true);
    expect(hasResolveModuleName()).toBe(true);
  });

  it("resolves a relative .js specifier to a TypeScript source file", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "esm-baseline"),
    });
    const mainToApp = snapshot.observations.find(
      (observation) =>
        observation.importerId === "src/main.ts" && observation.specifier === "./app.js",
    );
    expect(mainToApp?.resolution).toMatchObject({
      status: "internal",
      targetId: "src/app.ts",
      reasonCode: "RESOLVED_INTERNAL",
    });
  });

  it("resolves a paths alias through the compiler", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "alias-paths"),
    });
    const aliased = snapshot.observations.find(
      (observation) => observation.specifier === "@lib/money.ts",
    );
    expect(aliased?.resolution).toMatchObject({
      status: "internal",
      targetId: "src/lib/money.ts",
    });
  });
});

describe("unsupported constructs", () => {
  it("records dynamic import and import-type as classified omissions", () => {
    const snapshot = scanRepository({
      root: path.join(root, "fixtures", "unsupported-constructs"),
    });
    const kinds = snapshot.observations.map((observation) => observation.syntaxKind).sort();
    expect(kinds).toContain("require");
    expect(kinds).toContain("dynamic-import");
    expect(kinds).toContain("other-unsupported");
    const requireObservation = snapshot.observations.find((item) => item.syntaxKind === "require");
    expect(requireObservation?.resolution.status).toBe("unresolved");
    expect(
      snapshot.observations
        .filter((observation) => observation.syntaxKind !== "require")
        .every((observation) => observation.resolution.status === "unsupported"),
    ).toBe(true);
    expect(snapshot.coverage.constructCounts.unsupported).toBeGreaterThan(0);
  });
});
