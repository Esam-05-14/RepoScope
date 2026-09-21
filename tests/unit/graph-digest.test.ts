import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepository } from "@reposcope/engine";

function writeProject(source: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "reposcope-digest-"));
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
  writeFileSync(path.join(root, "src", "a.ts"), source);
  writeFileSync(path.join(root, "src", "b.ts"), "export const value = 1;\n");
  return root;
}

describe("graph digest stability", () => {
  it("is identical for two scans of the same bytes", () => {
    const first = scanRepository({
      root: writeProject('import { value } from "./b.js";\nexport const use = value;\n'),
    });
    const second = scanRepository({
      root: writeProject('import { value } from "./b.js";\nexport const use = value;\n'),
    });
    expect(first.graphDigest).toBe(second.graphDigest);
    expect(first.contentManifestDigest).toBe(second.contentManifestDigest);
  });

  it("does not change the graph digest for a comment-only edit", () => {
    const base = scanRepository({
      root: writeProject('import { value } from "./b.js";\nexport const use = value;\n'),
    });
    const commented = scanRepository({
      root: writeProject(
        'import { value } from "./b.js";\n// note\nexport const use = value;\n',
      ),
    });
    expect(commented.graphDigest).toBe(base.graphDigest);
    expect(commented.contentManifestDigest).not.toBe(base.contentManifestDigest);
  });

  it("does not treat a moved import as a new semantic relationship", () => {
    const original = scanRepository({
      root: writeProject('import { value } from "./b.js";\nexport const use = value;\n'),
    });
    const moved = scanRepository({
      root: writeProject(
        'export const prefix = 1;\nimport { value } from "./b.js";\nexport const use = value;\n',
      ),
    });
    expect(moved.graphDigest).toBe(original.graphDigest);
    expect(moved.observations[0]?.range.startLine).not.toBe(
      original.observations[0]?.range.startLine,
    );
  });
});
