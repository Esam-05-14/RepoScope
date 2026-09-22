import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepository } from "@reposcope/engine";

function writeProject(sourceA: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "reposcope-incr-"));
  mkdirSync(path.join(root, "src"));
  writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
      },
      include: ["src/**/*.ts"],
    }),
  );
  writeFileSync(path.join(root, "src", "a.ts"), sourceA);
  writeFileSync(path.join(root, "src", "b.ts"), "export const value = 1;\n");
  return root;
}

describe("incremental rescan", () => {
  it("reuses unchanged files by content hash and keeps the graph digest", () => {
    const root = writeProject('import { value } from "./b.js";\nexport const use = value;\n');
    const first = scanRepository({ root });
    expect(first.coverage.reusedFiles).toBe(0);
    const second = scanRepository({ root, previousSnapshot: first });
    expect(second.coverage.reusedFiles).toBe(first.nodes.length);
    expect(second.coverage.reusedResolutions).toBeGreaterThan(0);
    expect(second.graphDigest).toBe(first.graphDigest);
    expect(second.contentManifestDigest).toBe(first.contentManifestDigest);
    writeFileSync(path.join(root, "src", "b.ts"), "export const value = 2;\n");
    const third = scanRepository({ root, previousSnapshot: second });
    expect(third.coverage.reusedFiles).toBe(1);
    expect(third.contentManifestDigest).not.toBe(second.contentManifestDigest);
  });
});
