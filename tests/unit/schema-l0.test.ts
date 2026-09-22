import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@reposcope/contracts";
import { languageFromPath } from "@reposcope/parser-ts";
import { scanRepository } from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("L0 schema draft", () => {
  it("accepts py and java in the schema document and still writes 1.0.0", () => {
    const schema = JSON.parse(
      readFileSync(path.join(workspace, "contracts/schemas/analysis-snapshot.schema.json"), "utf8"),
    ) as {
      $id: string;
      $defs: {
        FileNode: { properties: { language: { enum: string[] } } };
        Resolution: { properties: { reasonCode: { enum: string[] } } };
        ProjectContext: { properties: { language: { enum: string[] } } };
      };
    };
    expect(schema.$id).toBe("https://reposcope.local/schemas/analysis-snapshot/1.1.0");
    expect(schema.$defs.FileNode.properties.language.enum).toEqual(
      expect.arrayContaining(["py", "java", "kt"]),
    );
    expect(schema.$defs.Resolution.properties.reasonCode.enum).toContain("WILDCARD_IMPORT");
    expect(schema.$defs.ProjectContext.properties.language.enum).toEqual([
      "typescript",
      "python",
      "java",
    ]);
    expect(SCHEMA_VERSION).toBe("1.0.0");
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    expect(snapshot.schemaVersion).toBe("1.0.0");
    expect(snapshot.nodes.some((node) => node.language === "py" || node.language === "java")).toBe(
      false,
    );
    expect(languageFromPath("app.py")).toBeUndefined();
    expect(languageFromPath("App.java")).toBeUndefined();
  });
});
