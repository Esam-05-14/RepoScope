import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanRepository, investigationBriefFromSnapshot } from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("investigation brief", () => {
  it("summarizes esm-baseline without source text or absolute paths", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    const { brief, markdown } = investigationBriefFromSnapshot(snapshot);
    expect(brief.scope.files).toBe(5);
    expect(brief.scope.internalEdges).toBeGreaterThan(0);
    expect(brief.hubs[0]?.id).toBe("src/app.ts");
    expect(brief.hubs[0]?.importedBy).toBe(2);
    expect(brief.hubs.some((hub) => hub.id === "src/lib/money.ts")).toBe(true);
    expect(brief.cycles.length).toBeGreaterThan(0);
    expect(markdown).toContain("src/lib/money.ts");
    expect(markdown).toContain("A -> B means A imports B");
    expect(markdown).toContain("Pasting into a cloud assistant leaves this machine");
    expect(markdown).not.toMatch(/[A-Za-z]:\\/);
    expect(markdown).not.toContain("sourceText");
    expect(brief.estimatedChars).toBe(markdown.length);
  });
});
