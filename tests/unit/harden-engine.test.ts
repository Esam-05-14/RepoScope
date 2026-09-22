import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  clearGitHubCache,
  loadPersistedSnapshots,
  persistSnapshot,
  pruneGitHubCache,
  scanRepository,
} from "@reposcope/engine";
import { buildInvestigationBrief, formatInvestigationBrief } from "@reposcope/contracts";
import { redactRequestUrl } from "@reposcope/server";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("engine hardening", () => {
  it("classifies css and svg specifiers as unsupported assets", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "asset-css"),
    });
    const reasons = snapshot.observations.map((item) => item.resolution.reasonCode);
    expect(reasons).toContain("ASSET_UNSUPPORTED");
    expect(snapshot.observations.every((item) => item.resolution.status === "unsupported")).toBe(true);
    expect(snapshot.nodes.map((node) => node.id)).not.toContain("src/app.css");
  });

  it("catalogs package.json names without installing them", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "declared-packages"),
    });
    expect(snapshot.coverage.declaredPackages).toEqual(["react", "vitest"]);
    const react = snapshot.observations.find((item) => item.specifier === "react");
    expect(react?.resolution.status).toBe("external");
  });

  it("counts skipped inventory directories", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "skip-dirs"),
    });
    expect(snapshot.coverage.skippedDirectories).toBeGreaterThanOrEqual(1);
    expect(snapshot.nodes.map((node) => node.id)).toEqual(["src/used.ts"]);
  });

  it("records tsconfig path mappings on the selected context", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "alias-paths"),
    });
    const context = snapshot.projectContexts?.find((item) => item.configPath === "tsconfig.json");
    expect(context?.pathMappings).toEqual(expect.arrayContaining(["@lib/* -> ./src/lib/*"]));
  });

  it("opts in string dynamic import without treating it as the default", () => {
    const omitted = scanRepository({
      root: path.join(workspace, "fixtures", "unsupported-constructs"),
    });
    const omittedDynamic = omitted.observations.find((item) => item.syntaxKind === "dynamic-import");
    expect(omittedDynamic?.resolution.status).toBe("unsupported");

    const included = scanRepository({
      root: path.join(workspace, "fixtures", "unsupported-constructs"),
      includeDynamicImport: true,
    });
    const includedDynamic = included.observations.find((item) => item.syntaxKind === "dynamic-import");
    expect(includedDynamic?.resolution.status).toBe("unresolved");
    expect(includedDynamic?.resolution.reasonCode).toBe("UNRESOLVED_MODULE");
  });

  it("caps persisted snapshots at 20 per identity", () => {
    const storeRoot = mkdtempSync(path.join(tmpdir(), "reposcope-prune-"));
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "self-import"),
    });
    for (let index = 0; index < 21; index += 1) {
      persistSnapshot(storeRoot, snapshot.scope.repositoryIdentity, `snap_${index}`, snapshot);
    }
    expect(loadPersistedSnapshots(storeRoot, snapshot.scope.repositoryIdentity)).toHaveLength(20);
  });

  it("prunes extra GitHub clone directories under the cache root", () => {
    const cacheRoot = mkdtempSync(path.join(tmpdir(), "reposcope-clones-"));
    for (let index = 0; index < 10; index += 1) {
      mkdirSync(path.join(cacheRoot, `owner--repo--${index}`));
    }
    expect(pruneGitHubCache(cacheRoot, 8)).toBe(2);
    expect(clearGitHubCache(cacheRoot)).toBe(8);
    expect(pruneGitHubCache(cacheRoot, 8)).toBe(0);
  });

  it("classifies node builtins and remote protocols", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "protocols"),
    });
    const node = snapshot.observations.find((item) => item.specifier === "node:fs");
    expect(node?.resolution).toMatchObject({ status: "external", reasonCode: "NODE_BUILTIN" });
    expect(
      snapshot.observations.some(
        (item) => item.specifier.startsWith("https:") && item.resolution.reasonCode === "PROTOCOL_UNSUPPORTED",
      ),
    ).toBe(true);
    expect(
      snapshot.observations.some(
        (item) => item.specifier.startsWith("data:") && item.resolution.reasonCode === "PROTOCOL_UNSUPPORTED",
      ),
    ).toBe(true);
  });

  it("resolves triple-slash path references as observed dependencies", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "triple-slash"),
    });
    const reference = snapshot.observations.find((item) => item.syntaxKind === "triple-slash-path");
    expect(reference?.resolution).toMatchObject({
      status: "internal",
      targetId: "src/dep.ts",
    });
  });

  it("redacts tokens from request URLs", () => {
    expect(redactRequestUrl("/explore?token=super-secret#token=also")).toBe("/explore?token=[redacted]");
  });
});

describe("brief privacy and density", () => {
  it("warns that path lists leave the machine when pasted", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    const brief = buildInvestigationBrief(snapshot, []);
    const compact = formatInvestigationBrief(brief, { density: "compact" });
    const full = formatInvestigationBrief(brief, { density: "full" });
    expect(compact).toContain("RepoScope investigation brief (compact)");
    expect(compact).toContain("Pasting into a cloud assistant leaves this machine");
    expect(compact).toContain("lists repository paths");
    expect(compact).toContain("top");
    expect(full).toContain("RepoScope investigation brief (full)");
    expect(full).toContain("adjacency A>B,C (A imports B and C)");
  });
});
