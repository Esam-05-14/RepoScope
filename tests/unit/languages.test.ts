import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componentIdForFile, includedByPolicy } from "@reposcope/graph";
import { fileRole } from "@reposcope/contracts";
import {
  ConfinedFilesystemHost,
  investigationBriefFromSnapshot,
  scanRepository,
} from "@reposcope/engine";
import { visibleFileIds } from "../../apps/web/src/lib/view-filter.ts";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ESM_DIGEST = "sha256:f5400f91a35006f75d5264169bc0c18f5a7e2857293044db4b51d3256efb5206";

function fixture(name: string): string {
  return path.join(workspace, "fixtures", name);
}

function assertSourceFree(snapshot: ReturnType<typeof scanRepository>): void {
  const json = JSON.stringify(snapshot);
  expect(json).not.toMatch(/[A-Za-z]:\\/);
  expect(json).not.toContain("SOURCE_LEAK_TOKEN");
  for (const node of snapshot.nodes) {
    expect(node.relativePath.includes("\\")).toBe(false);
    expect(node.relativePath.startsWith("/")).toBe(false);
  }
}

describe("language waves", () => {
  it("keeps the esm-baseline graph digest and reuses only the current parser version", () => {
    const root = fixture("esm-baseline");
    const first = scanRepository({ root, scanId: "lang-digest" });
    const second = scanRepository({ root, previousSnapshot: first });
    expect(first.graphDigest).toBe(ESM_DIGEST);
    expect(first.schemaVersion).toBe("1.0.0");
    expect(first.parserVersion).toBe("typescript@6.0.3");
    expect(second.graphDigest).toBe(first.graphDigest);
    expect(second.coverage.reusedFiles).toBeGreaterThan(0);
    const stale = scanRepository({
      root,
      previousSnapshot: { ...first, parserVersion: "typescript@0.0.0" },
    });
    expect(stale.coverage.reusedFiles).toBe(0);
    expect(stale.graphDigest).toBe(first.graphDigest);
  });

  it("resolves Python imports without running setup.py", () => {
    const marker = path.join(fixture("python-setup"), "SETUP_RAN");
    rmSync(marker, { force: true });
    const relative = scanRepository({ root: fixture("python-relative") });
    const src = scanRepository({ root: fixture("python-src") });
    const cfg = scanRepository({ root: fixture("python-cfg") });
    const typing = scanRepository({ root: fixture("python-typing") });
    const setup = scanRepository({ root: fixture("python-setup") });

    const helper = relative.observations.find(
      (item) => item.importerId === "pkg/app.py" && item.specifier === ".util",
    );
    expect(helper?.resolution).toMatchObject({ status: "internal", targetId: "pkg/util.py" });
    expect(helper?.range.startLine).toBe(1);
    expect(helper?.range.startOffset).toBeGreaterThan(0);
    expect(
      relative.observations.find((item) => item.specifier === "pkg.missing")?.resolution.status,
    ).toBe("unresolved");
    expect(
      relative.observations.find((item) => item.specifier === "requests")?.resolution.status,
    ).toBe("external");
    expect(
      relative.observations.find(
        (item) =>
          item.importerId === "pkg/app.py" &&
          item.specifier === "pkg.util" &&
          item.syntaxKind === "other-unsupported",
      )?.resolution.targetId,
    ).toBe("pkg/util.py");
    expect(relative.nodes.some((node) => node.relativePath.includes("hidden.py"))).toBe(false);

    const star = relative.observations.find(
      (item) => item.importerId === "pkg/wild.py" && item.resolution.reasonCode === "WILDCARD_IMPORT",
    );
    expect(star?.resolution.status).toBe("unsupported");
    expect(
      relative.semanticEdges.some((edge) => edge.importerId === "pkg/wild.py" && edge.targetId === "pkg/util.py"),
    ).toBe(false);
    expect(
      relative.observations.find((item) => item.importerId === "pkg/wild.py" && item.specifier === "pkg.other")
        ?.resolution.targetId,
    ).toBe("pkg/other.py");

    expect(
      src.observations.find((item) => item.importerId === "src/demo/app.py")?.resolution.targetId,
    ).toBe("src/demo/util.py");
    expect(componentIdForFile("src/demo/app.py", src.coverage.workspacePackages ?? [])).toBe("pkg:demo");
    expect(src.schemaVersion).toBe("1.1.0");
    expect(src.parserVersion.length).toBeLessThanOrEqual(64);
    expect(src.parserVersion).toContain("py-import@2");
    assertSourceFree(src);
    expect(scanRepository({ root: fixture("python-src") }).graphDigest).toBe(src.graphDigest);

    expect(
      cfg.observations.find((item) => item.importerId === "lib/cfgdemo/app.py")?.resolution.targetId,
    ).toBe("lib/cfgdemo/util.py");
    expect(componentIdForFile("lib/cfgdemo/app.py", cfg.coverage.workspacePackages ?? [])).toBe(
      "pkg:cfgdemo",
    );

    const typeEdge = typing.semanticEdges.find(
      (edge) => edge.importerId === "a.py" && edge.targetId === "b.py",
    );
    expect(typeEdge?.edgeClass).toBe("type");
    expect(includedByPolicy(typeEdge?.edgeClass ?? "type", "value-and-mixed")).toBe(false);
    const brief = investigationBriefFromSnapshot(typing).brief;
    expect(brief.adjacency.some((row) => row.from === "a.py" && row.to.includes("b.py"))).toBe(false);
    expect(brief.claims.some((claim) => claim.includes("Python, Java, and Kotlin"))).toBe(true);

    expect(
      setup.observations.find((item) => item.importerId === "setup.py" && item.specifier === "demo.util")
        ?.resolution.targetId,
    ).toBe("src/demo/util.py");
    expect(existsSync(marker)).toBe(false);
    expect(fileRole("pkg/test_app.py")).toBe("test");
    expect(fileRole("pkg/app_test.py")).toBe("test");
    expect(fileRole("pkg/app.py")).toBe("source");
  });

  it("resolves Maven types without running Maven or reading a parent POM", () => {
    const pluginMarker = path.join(fixture("java-reactor"), "PLUGIN_RAN");
    rmSync(pluginMarker, { force: true });
    const reactor = scanRepository({ root: fixture("java-reactor") });
    const main = "app/src/main/java/com/example/app/Main.java";
    const widget = "api/src/main/java/com/example/api/Widget.java";
    expect(
      reactor.observations.find(
        (item) =>
          item.importerId === main &&
          item.specifier === "com.example.api.Widget" &&
          item.syntaxKind === "static-import",
      )?.resolution.targetId,
    ).toBe(widget);
    expect(
      reactor.observations.find(
        (item) => item.importerId === main && item.importedNames?.includes("name"),
      )?.resolution.targetId,
    ).toBe(widget);
    expect(
      reactor.observations.find((item) => item.specifier === "com.example.api.Gone")?.resolution.status,
    ).toBe("unresolved");
    expect(
      reactor.observations.find((item) => item.specifier === "org.junit.Test")?.resolution.status,
    ).toBe("external");
    expect(
      reactor.observations.find((item) => item.specifier === "com.example.api.*")?.resolution.reasonCode,
    ).toBe("WILDCARD_IMPORT");
    expect(
      reactor.semanticEdges.some(
        (edge) => edge.importerId === main && edge.targetId === widget && edge.unresolvedSpecifier === "com.example.api.*",
      ),
    ).toBe(false);
    expect(
      reactor.observations.find((item) => item.specifier === "com.example.api.Widget" && item.syntaxKind === "other-unsupported")
        ?.resolution.targetId,
    ).toBe(widget);
    expect(
      reactor.observations.find((item) => item.specifier === "java.base")?.resolution.status,
    ).toBe("external");
    expect(reactor.nodes.some((node) => node.relativePath.includes("Skipped.java"))).toBe(false);
    expect(reactor.observations.some((item) => item.importerId === widget)).toBe(false);
    expect(fileRole("app/src/test/java/com/example/app/MainTest.java")).toBe("test");
    expect(componentIdForFile(main, reactor.coverage.workspacePackages ?? [])).toBe("pkg:app");
    expect(componentIdForFile(widget, reactor.coverage.workspacePackages ?? [])).toBe("pkg:api");
    expect(existsSync(pluginMarker)).toBe(false);
    assertSourceFree(reactor);
    expect(scanRepository({ root: fixture("java-reactor") }).graphDigest).toBe(reactor.graphDigest);

    const parentRoot = fixture("java-parent");
    const host = new ConfinedFilesystemHost(parentRoot);
    const parent = scanRepository({ root: parentRoot, host });
    expect(parent.coverage.truncations.some((item) => item.startsWith("config-outside-root:"))).toBe(true);
    expect(host.deniedReads.some((item) => item.includes("outside-trap"))).toBe(false);
    expect(JSON.stringify(parent)).not.toContain("PARENT_POM_FETCHED");

    const doctype = scanRepository({ root: fixture("java-doctype") });
    expect(doctype.coverage.truncations.some((item) => item.startsWith("xml-doctype-skipped:"))).toBe(true);
    expect(JSON.stringify(doctype)).not.toContain("EXPANDED_ENTITY");
  });

  it("reads Gradle include strings and Kotlin imports without running Gradle", () => {
    const gradleMarker = path.join(fixture("gradle-include"), "GRADLE_RAN");
    rmSync(gradleMarker, { force: true });
    const gradle = scanRepository({ root: fixture("gradle-include") });
    expect(
      gradle.observations.find((item) => item.specifier === "com.example.lib.Lib")?.resolution.targetId,
    ).toBe("lib/src/main/java/com/example/lib/Lib.java");
    expect(
      gradle.observations.find((item) => item.specifier === "com.example.core.Core")?.resolution.targetId,
    ).toBe("nested/core/src/main/java/com/example/core/Core.java");
    const packages = gradle.coverage.workspacePackages ?? [];
    expect(packages.some((item) => item.directory === "not-a-module")).toBe(false);
    expect(packages.some((item) => item.name === "projectName")).toBe(false);
    expect(existsSync(gradleMarker)).toBe(false);

    const kotlin = scanRepository({ root: fixture("kotlin-app") });
    const app = "app/src/main/kotlin/com/example/App.kt";
    expect(
      kotlin.observations.find((item) => item.importerId === app && item.specifier === "com.example.lib.Widget")
        ?.resolution.targetId,
    ).toBe("app/src/main/kotlin/com/example/lib/Widget.kt");
    expect(
      kotlin.observations.find((item) => item.importerId === app && item.specifier === "com.example.JavaSide")
        ?.resolution.targetId,
    ).toBe("app/src/main/java/com/example/JavaSide.java");
    expect(
      kotlin.observations.find((item) => item.specifier.endsWith(".*"))?.resolution.reasonCode,
    ).toBe("WILDCARD_IMPORT");
    expect(
      kotlin.observations.find(
        (item) => item.importerId.endsWith("JavaSide.java") && item.specifier === "com.example.lib.Widget",
      )?.resolution.targetId,
    ).toBe("app/src/main/kotlin/com/example/lib/Widget.kt");
    expect(kotlin.nodes.some((node) => node.language === "kt")).toBe(true);
    expect(kotlin.schemaVersion).toBe("1.1.0");
  });

  it("does not draw a TypeScript edge to a Python file and can filter the graph by language", () => {
    const mixed = scanRepository({ root: fixture("mixed-lang") });
    expect(
      mixed.semanticEdges.some((edge) => edge.importerId === "src/app.ts" && edge.targetId === "src/other.ts"),
    ).toBe(true);
    expect(mixed.semanticEdges.some((edge) => edge.targetId === "src/note.py")).toBe(false);
    const pythonIds = visibleFileIds(mixed, {
      lens: "investigation",
      includeTests: true,
      hideIsolated: false,
      language: "python",
    });
    expect(pythonIds).toEqual(["src/note.py"]);
    const typescriptIds = visibleFileIds(mixed, {
      lens: "investigation",
      includeTests: true,
      hideIsolated: false,
      language: "typescript",
    });
    expect(typescriptIds).toEqual(["src/app.ts", "src/other.ts"]);
  });
});
