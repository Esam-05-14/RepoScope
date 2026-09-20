import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeDirectory, demoRoot } from "../../apps/cli/src/root.ts";

describe("CLI root selection", () => {
  it("resolves the bundled demo fixture without an absolute API label", () => {
    const demo = demoRoot(process.cwd());
    expect(demo.label).toBe("fixtures/esm-baseline");
    expect(demo.canonicalRoot.endsWith("esm-baseline")).toBe(true);
  });

  it("rejects a file and a symlink root", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "reposcope-r1-"));
    const file = path.join(dir, "not-a-dir.txt");
    writeFileSync(file, "no");
    expect(() => canonicalizeDirectory(file)).toThrow(/directory/);

    if (process.platform === "win32") {
      return;
    }
    const link = path.join(dir, "link");
    symlinkSync(dir, link);
    expect(() => canonicalizeDirectory(link)).toThrow(/symlink/);
  });
});
