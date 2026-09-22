import { describe, expect, it } from "vitest";
import {
  externalKind,
  fileRole,
  formatInvestigationBrief,
  libraryNodeId,
  parseLibraryNodeId,
} from "@reposcope/contracts";
import { scanRepository, investigationBriefFromSnapshot } from "@reposcope/engine";
import { visibleFileIds } from "../../apps/web/src/lib/view-filter.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("view classification", () => {
  it("separates source, test, config, and builtins", () => {
    expect(fileRole("apps/web/src/app.tsx")).toBe("source");
    expect(fileRole("tests/unit/tokens.test.ts")).toBe("test");
    expect(fileRole("vitest.config.ts")).toBe("config");
    expect(fileRole("apps/web/src/vite-env.d.ts")).toBe("config");
    expect(externalKind("react")).toBe("library");
    expect(externalKind("node:path")).toBe("builtin");
    expect(parseLibraryNodeId(libraryNodeId("react"))).toBe("react");
  });
});

describe("brief lenses", () => {
  it("records asset omissions by reason code and keeps library lists out of your-code markdown", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "asset-css"),
    });
    const { brief } = investigationBriefFromSnapshot(snapshot);
    expect(brief.unsupported.some((item) => item.reason === "ASSET_UNSUPPORTED")).toBe(true);
    const yours = formatInvestigationBrief(brief, { density: "compact", lens: "investigation" });
    const libs = formatInvestigationBrief(brief, { density: "compact", lens: "libraries" });
    expect(yours).toContain("lens your-code");
    expect(yours).toContain("library counts");
    expect(libs).toContain("RepoScope library catalog");
    expect(libs).toContain("lens libraries");
  });
});

describe("visible file filter", () => {
  it("hides config and isolated files in the your-code lens", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "asset-css"),
    });
    const yours = visibleFileIds(snapshot, {
      lens: "investigation",
      includeTests: true,
      hideIsolated: true,
    });
    const all = visibleFileIds(snapshot, {
      lens: "libraries",
      includeTests: true,
      hideIsolated: false,
    });
    expect(yours.every((id) => fileRole(id) !== "config")).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(yours.length);
  });
});
