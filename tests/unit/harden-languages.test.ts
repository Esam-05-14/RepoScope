import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ConfinedFilesystemHost, scanRepository } from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

function tempProject(name: string): { parent: string; root: string } {
  const parent = mkdtempSync(path.join(tmpdir(), `reposcope-${name}-`));
  const root = path.join(parent, "project");
  mkdirSync(root);
  return { parent, root };
}

describe("language engine hardening", () => {
  it("does not guess a project root when the declared layout leaves the root", () => {
    const { parent, root } = tempProject("py-escape");
    writeFileSync(path.join(parent, "secret.py"), "SECRET_TOKEN = 1\n");
    writeFileSync(
      path.join(root, "pyproject.toml"),
      '[project]\nname = "demo"\n\n[tool.setuptools.packages.find]\nwhere = ["../secret"]\n',
    );
    writeFileSync(path.join(root, "app.py"), "import secret\nimport localmod\n");
    writeFileSync(path.join(root, "localmod.py"), "VALUE = 1\n");
    const host = new ConfinedFilesystemHost(root);
    const snapshot = scanRepository({ root, host });
    expect(snapshot.coverage.truncations.some((item) => item.startsWith("source-root-outside:"))).toBe(
      true,
    );
    expect(
      snapshot.observations.find((item) => item.specifier === "localmod")?.resolution.status,
    ).toBe("external");
    expect(snapshot.observations.some((item) => item.resolution.status === "internal")).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain("SECRET_TOKEN");
    expect(host.deniedReads.some((item) => item.includes("secret.py"))).toBe(false);
  });

  it("keeps an in-root declared root when another declared root escapes", () => {
    const { root } = tempProject("py-mixed-root");
    writeFileSync(
      path.join(root, "pyproject.toml"),
      '[project]\nname = "demo"\n\n[tool.setuptools.packages.find]\nwhere = ["src", "../outside"]\n',
    );
    mkdirSync(path.join(root, "src", "demo"), { recursive: true });
    writeFileSync(path.join(root, "src", "demo", "__init__.py"), "");
    writeFileSync(path.join(root, "src", "demo", "util.py"), "VALUE = 1\n");
    writeFileSync(path.join(root, "src", "demo", "app.py"), "import demo.util\n");
    const snapshot = scanRepository({ root });
    expect(
      snapshot.observations.find((item) => item.specifier === "demo.util")?.resolution.targetId,
    ).toBe("src/demo/util.py");
    expect(snapshot.coverage.truncations.some((item) => item.startsWith("source-root-outside:"))).toBe(
      true,
    );
  });

  it("resolves a package-relative import from __init__.py and ignores imports in strings", () => {
    const { root } = tempProject("py-init");
    mkdirSync(path.join(root, "pkg"));
    writeFileSync(path.join(root, "pkg", "__init__.py"), "from . import util\n");
    writeFileSync(path.join(root, "pkg", "util.py"), "VALUE = 1\n");
    writeFileSync(
      path.join(root, "pkg", "app.py"),
      'note = "import missing_secret"\n# import missing_secret\nimport pkg.util\n',
    );
    writeFileSync(
      path.join(root, "typed.py"),
      "if TYPE_CHECKING: import pkg.util\n",
    );
    const snapshot = scanRepository({ root });
    expect(
      snapshot.observations.find((item) => item.importerId === "pkg/__init__.py")?.resolution.targetId,
    ).toBe("pkg/util.py");
    expect(snapshot.observations.some((item) => item.specifier === "missing_secret")).toBe(false);
    const typed = snapshot.observations.find((item) => item.importerId === "typed.py");
    expect(typed?.edgeClass).toBe("type");
    expect(typed?.resolution.targetId).toBe("pkg/util.py");
  });

  it("reads an import that follows a UTF-8 BOM and reuses the next scan", () => {
    const { root } = tempProject("py-bom");
    writeFileSync(path.join(root, "app.py"), "\uFEFFimport localmod\n", "utf8");
    writeFileSync(path.join(root, "localmod.py"), "VALUE = 1\n");
    const first = scanRepository({ root });
    const second = scanRepository({ root, previousSnapshot: first });
    expect(
      first.observations.find((item) => item.specifier === "localmod")?.resolution.targetId,
    ).toBe("localmod.py");
    expect(second.coverage.reusedFiles).toBe(first.nodes.length);
    expect(second.graphDigest).toBe(first.graphDigest);
  });

  it("caps observation ids and records an observation overflow", () => {
    const { root } = tempProject("py-ids");
    const deep = "d".repeat(120);
    mkdirSync(path.join(root, deep));
    writeFileSync(path.join(root, deep, "b.py"), "VALUE = 1\n");
    writeFileSync(path.join(root, deep, "a.py"), "from . import b\n");
    const names = Array.from({ length: 520 }, (_item, index) => `m${index}`);
    writeFileSync(
      path.join(root, "many.py"),
      names.map((name) => `import ${name}`).join("\n"),
    );
    const snapshot = scanRepository({ root });
    const ids = snapshot.observations.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length <= 128 && id.startsWith("obs:"))).toBe(true);
    expect(
      snapshot.observations.find((item) => item.importerId === `${deep}/a.py`)?.resolution.targetId,
    ).toBe(`${deep}/b.py`);
    expect(snapshot.coverage.truncations.some((item) => item.startsWith("max-observations:"))).toBe(
      true,
    );
  });

  it("ignores Gradle includes that climb out of the root", () => {
    const { parent, root } = tempProject("gradle-escape");
    mkdirSync(path.join(parent, "secret"));
    writeFileSync(path.join(parent, "secret", "marker.txt"), "GRADLE_SECRET");
    writeFileSync(
      path.join(root, "settings.gradle"),
      'include("app")\ninclude("../secret")\ninclude(":..:secret")\n',
    );
    mkdirSync(path.join(root, "app", "src", "main", "java", "com", "example"), { recursive: true });
    writeFileSync(
      path.join(root, "app", "src", "main", "java", "com", "example", "App.java"),
      "package com.example;\npublic class App {}\n",
    );
    const host = new ConfinedFilesystemHost(root);
    const snapshot = scanRepository({ root, host });
    const directories = snapshot.coverage.workspacePackages?.map((item) => item.directory) ?? [];
    expect(directories).toContain("app");
    expect(directories.some((item) => item.includes("secret"))).toBe(false);
    expect(snapshot.coverage.truncations.some((item) => item.startsWith("config-outside-root:"))).toBe(
      true,
    );
    expect(JSON.stringify(snapshot)).not.toContain("GRADLE_SECRET");
    expect(host.deniedReads.some((item) => item.includes("secret"))).toBe(false);
  });

  it("does not treat a Java import hidden in a string or comment as a dependency", () => {
    const { root } = tempProject("java-string");
    const base = path.join(root, "src", "main", "java", "com", "example");
    mkdirSync(base, { recursive: true });
    writeFileSync(
      path.join(base, "App.java"),
      [
        "package com.example;",
        "public class App {",
        '  String skipped = "import com.example.Nope;";',
        "  // import com.example.Nope;",
        "}",
      ].join("\n"),
    );
    writeFileSync(
      path.join(base, "Lib.java"),
      "package com.example;\nimport com.example.App;\npublic class Lib {}\n",
    );
    const snapshot = scanRepository({ root });
    expect(snapshot.observations.some((item) => item.specifier.includes("Nope"))).toBe(false);
    expect(
      snapshot.observations.find((item) => item.specifier === "com.example.App")?.resolution.targetId,
    ).toBe("src/main/java/com/example/App.java");
  });

  it("rejects a pom entity that is not a predefined entity", () => {
    const { root } = tempProject("xml-entity");
    writeFileSync(
      path.join(root, "pom.xml"),
      "<project><artifactId>&nope;</artifactId></project>\n",
    );
    const snapshot = scanRepository({ root });
    expect(snapshot.coverage.truncations.some((item) => item.startsWith("xml-rejected:"))).toBe(true);
    expect(JSON.stringify(snapshot.coverage.workspacePackages ?? [])).not.toContain("nope");
  });

  it("keeps a star import off the semantic graph", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "python-relative"),
    });
    expect(
      snapshot.observations.some((item) => item.resolution.reasonCode === "WILDCARD_IMPORT"),
    ).toBe(true);
    expect(
      snapshot.semanticEdges.some((edge) => edge.unresolvedSpecifier === "pkg.util"),
    ).toBe(false);
  });

  it("keeps the esm-baseline graph digest", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "esm-baseline"),
    });
    expect(snapshot.graphDigest).toBe(
      "sha256:f5400f91a35006f75d5264169bc0c18f5a7e2857293044db4b51d3256efb5206",
    );
    expect(snapshot.projectContexts?.every((context) => context.id.length <= 128)).toBe(true);
  });
});
