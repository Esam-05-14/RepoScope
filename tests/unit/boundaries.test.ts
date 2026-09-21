import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateBoundaryPolicy, scanRepository } from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("boundary policy", () => {
  it("cites the rule and observation for a forbidden edge", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-revised"),
    });
    const violations = evaluateBoundaryPolicy(snapshot, {
      schemaVersion: "1.0.0",
      groups: {
        lib: ["src/lib/**"],
        app: ["src/main.ts", "src/app.ts"],
      },
      forbid: [{ id: "lib-must-not-import-app", from: "lib", to: "app" }],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      ruleId: "lib-must-not-import-app",
      importerId: "src/lib/money.ts",
      targetId: "src/main.ts",
      fromGroup: "lib",
      toGroup: "app",
    });
    expect(violations[0]?.observationId.startsWith("obs:")).toBe(true);
  });
});
