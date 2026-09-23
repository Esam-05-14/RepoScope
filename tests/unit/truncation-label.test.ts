import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRODUCT_VERSION } from "@reposcope/contracts";
import { graphWindowCopy, truncationLabel } from "../../apps/web/src/lib/truncation-label.ts";

describe("truncation labels", () => {
  it("explains a coded limit and keeps the path", () => {
    expect(truncationLabel("source-root-outside:pyproject.toml")).toBe(
      "A declared source root left the selected directory and was not used. pyproject.toml",
    );
    expect(truncationLabel("max-source-files")).toBe(
      "Scan stopped at the source-file limit. Later files were not analyzed.",
    );
    expect(truncationLabel("unknown-limit:note")).toBe("A scan limit was recorded. note");
  });

  it("states how much of the file graph is on screen", () => {
    expect(graphWindowCopy(250, 900, 400, 250, 500)).toContain("Showing 250 of 900 files");
    expect(graphWindowCopy(250, 900, 400, 250, 500)).toContain("file list still contains the rest");
  });
});

describe("product version", () => {
  it("matches the root package version", () => {
    const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
    expect(pkg.version).toBe(PRODUCT_VERSION);
    expect(PRODUCT_VERSION).toBe("0.11.0");
  });
});
