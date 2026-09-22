import type { ProjectContext, WorkspacePackage } from "@reposcope/contracts";
import { inferredCompilerOptions } from "@reposcope/parser-ts";
import { extractGradleIncludes, readPom } from "@reposcope/parser-java";
import { readPyProject, readSetupCfg } from "@reposcope/parser-py";
import type { BoundContext } from "../contexts.js";
import { boundedContextId, digestOf, directoryIndex, isUnder, joinInside, safePackageName } from "./paths.js";

export interface PythonProject {
  directory: string;
  roots: string[];
  context: BoundContext;
}

export interface JvmModule {
  directory: string;
  name: string;
  javaRoots: string[];
  kotlinRoots: string[];
  context: BoundContext;
}

export interface LanguageModel {
  python: PythonProject[];
  jvm: JvmModule[];
  pythonInferred: BoundContext;
  jvmInferred: BoundContext;
  records: ProjectContext[];
  workspacePackages: WorkspacePackage[];
  truncations: string[];
  files: ReadonlySet<string>;
  directories: ReadonlySet<string>;
  inferredPythonRoots: string[];
  inferredJavaRoots: string[];
  inferredKotlinRoots: string[];
  contextFor(relativePath: string, language: "py" | "java" | "kt"): BoundContext;
}

export interface ManifestText {
  relativePath: string;
  text: string;
}

const MANIFEST_CAP = 256 * 1024;

function bound(record: ProjectContext): BoundContext {
  return { record, options: inferredCompilerOptions(), fileNames: [] };
}

function nearest<T extends { directory: string }>(file: string, items: readonly T[]): T | undefined {
  return items
    .filter((item) => isUnder(file, item.directory))
    .sort((left, right) => right.directory.length - left.directory.length)[0];
}

function declaredRoots(
  directory: string,
  roots: readonly string[],
): { roots: string[]; escaped: boolean } {
  const joined: string[] = [];
  let escaped = false;
  for (const root of roots) {
    const inside = joinInside(directory, root.replaceAll("${project.basedir}", ".").replace(/^\.\//, ""));
    if (inside === undefined) {
      escaped = true;
      continue;
    }
    joined.push(inside);
  }
  return { roots: joined, escaped };
}

function sourceRoot(directory: string, value: string | undefined, fallback: string): string | undefined {
  const raw = (value ?? fallback).replaceAll("${project.basedir}", ".").replace(/^\.\//, "");
  if (raw.includes("${")) {
    return undefined;
  }
  return joinInside(directory, raw);
}

export function buildLanguageModel(input: {
  files: readonly string[];
  manifests: readonly ManifestText[];
}): LanguageModel {
  const files = new Set(input.files);
  const truncations: string[] = [];
  const pythonByDir = new Map<string, { pyproject?: string; setupCfg?: string; configPath: string }>();
  const poms: { directory: string; relativePath: string; text: string }[] = [];
  const settings: { directory: string; relativePath: string; text: string }[] = [];

  for (const manifest of input.manifests) {
    if (manifest.text.length > MANIFEST_CAP) {
      truncations.push(`manifest-too-large:${manifest.relativePath}`);
      continue;
    }
    const slash = manifest.relativePath.lastIndexOf("/");
    const directory = slash < 0 ? "" : manifest.relativePath.slice(0, slash);
    const name = slash < 0 ? manifest.relativePath : manifest.relativePath.slice(slash + 1);
    if (name === "pyproject.toml" || name === "setup.cfg") {
      const current = pythonByDir.get(directory) ?? { configPath: manifest.relativePath };
      if (name === "pyproject.toml") {
        current.pyproject = manifest.text;
        current.configPath = manifest.relativePath;
      } else {
        current.setupCfg = manifest.text;
        if (current.pyproject === undefined) {
          current.configPath = manifest.relativePath;
        }
      }
      pythonByDir.set(directory, current);
    } else if (name === "pom.xml") {
      poms.push({ directory, relativePath: manifest.relativePath, text: manifest.text });
    } else if (name === "settings.gradle" || name === "settings.gradle.kts") {
      settings.push({ directory, relativePath: manifest.relativePath, text: manifest.text });
    }
  }

  const workspacePackages: WorkspacePackage[] = [];
  const python: PythonProject[] = [];
  for (const [directory, config] of pythonByDir) {
    const layout = config.pyproject !== undefined ? readPyProject(config.pyproject) : { roots: undefined, name: undefined };
    const cfg = config.setupCfg !== undefined ? readSetupCfg(config.setupCfg) : { roots: undefined, name: undefined };
    const declared = layout.roots ?? cfg.roots;
    let roots: string[];
    if (declared !== undefined) {
      const parsed = declaredRoots(directory, declared);
      if (parsed.escaped) {
        truncations.push(`source-root-outside:${config.configPath}`);
      }
      roots = parsed.roots;
    } else {
      const prefix = directory === "" ? "src/" : `${directory}/src/`;
      const hasSrc = input.files.some((file) => file.startsWith(prefix) && file.endsWith(".py"));
      const srcRoot = directory === "" ? "src" : `${directory}/src`;
      roots = hasSrc ? [srcRoot, directory] : [directory];
    }
    const name = safePackageName(layout.name ?? cfg.name ?? "");
    const record: ProjectContext = {
      id: boundedContextId(config.configPath),
      kind: "inferred",
      configPath: config.configPath,
      digest: digestOf(`python\n${config.configPath}\n${roots.join("\n")}`),
      language: "python",
    };
    python.push({ directory, roots, context: bound(record) });
    const componentDir = roots.find((root) => root !== "" && root !== ".");
    if (name !== undefined && componentDir !== undefined) {
      workspacePackages.push({ name, directory: componentDir });
    }
  }

  const modules = new Map<string, JvmModule>();
  const addModule = (module: JvmModule): void => {
    if (!modules.has(module.directory)) {
      modules.set(module.directory, module);
    }
  };

  for (const pom of poms) {
    const info = readPom(pom.text);
    if (info.rejected) {
      const kind = /<!DOCTYPE|<!ENTITY/i.test(pom.text) ? "xml-doctype-skipped" : "xml-rejected";
      truncations.push(`${kind}:${pom.relativePath}`);
      continue;
    }
    if (info.parentDeclared) {
      const parentPath = joinInside(pom.directory, info.parentRelativePath ?? "../pom.xml");
      if (parentPath === undefined) {
        truncations.push(`config-outside-root:${pom.relativePath}`);
      }
    }
    const main = sourceRoot(pom.directory, info.sourceDirectory, "src/main/java");
    const test = sourceRoot(pom.directory, info.testSourceDirectory, "src/test/java");
    if (main === undefined || test === undefined) {
      truncations.push(`source-root-outside:${pom.relativePath}`);
    }
    const javaRoots = [main, test].filter((root): root is string => root !== undefined);
    const kotlinMain = sourceRoot(pom.directory, undefined, "src/main/kotlin");
    const kotlinTest = sourceRoot(pom.directory, undefined, "src/test/kotlin");
    const kotlinRoots = [kotlinMain, kotlinTest].filter((root): root is string => root !== undefined);
    const fallbackName = pom.directory === "" ? "root" : (pom.directory.split("/").pop() ?? "module");
    const name = safePackageName(info.artifactId ?? fallbackName) ?? fallbackName;
    const record: ProjectContext = {
      id: boundedContextId(pom.relativePath),
      kind: "inferred",
      configPath: pom.relativePath,
      language: "java",
      digest: "sha256:" + "0".repeat(64),
    };
    addModule({
      directory: pom.directory,
      name,
      javaRoots: javaRoots.length > 0 ? javaRoots : [],
      kotlinRoots,
      context: bound(record),
    });
    if (pom.directory !== "") {
      workspacePackages.push({ name, directory: pom.directory });
    }
    for (const modulePath of info.modules) {
      const child = joinInside(pom.directory, modulePath);
      if (child === undefined) {
        truncations.push(`config-outside-root:${pom.relativePath}`);
      }
    }
  }

  for (const file of settings) {
    const gradle = extractGradleIncludes(file.text);
    if (gradle.rejected) {
      truncations.push(`config-outside-root:${file.relativePath}`);
    }
    for (const include of gradle.directories) {
      const directory = joinInside(file.directory, include);
      if (directory === undefined || directory === "") {
        truncations.push(`config-outside-root:${file.relativePath}`);
        continue;
      }
      if (modules.has(directory)) {
        continue;
      }
      const name = safePackageName(directory.split("/").pop() ?? directory) ?? directory;
      const record: ProjectContext = {
        id: boundedContextId(`gradle:${directory}`),
        kind: "inferred",
        configPath: file.relativePath,
        language: "java",
        digest: "sha256:" + "0".repeat(64),
      };
      const main = sourceRoot(directory, undefined, "src/main/java");
      const test = sourceRoot(directory, undefined, "src/test/java");
      const kotlinMain = sourceRoot(directory, undefined, "src/main/kotlin");
      const kotlinTest = sourceRoot(directory, undefined, "src/test/kotlin");
      addModule({
        directory,
        name,
        javaRoots: [main, test].filter((root): root is string => root !== undefined),
        kotlinRoots: [kotlinMain, kotlinTest].filter((root): root is string => root !== undefined),
        context: bound(record),
      });
      workspacePackages.push({ name, directory });
    }
  }

  const jvm = [...modules.values()].sort((left, right) => left.directory.localeCompare(right.directory));
  const reactor = jvm
    .map((module) => `${module.directory}|${module.javaRoots.join(",")}|${module.kotlinRoots.join(",")}`)
    .join("\n");
  const reactorDigest = digestOf(`jvm\n${reactor}`);
  for (const module of jvm) {
    module.context.record.digest = reactorDigest;
  }

  const srcPython = input.files.some((file) => file.startsWith("src/") && file.endsWith(".py"));
  const pythonInferred = bound({
    id: "ctx:python-inferred",
    kind: "inferred",
    configPath: null,
    language: "python",
    digest: digestOf(srcPython ? "python-inferred\nsrc\n" : "python-inferred\n"),
  });
  const jvmInferred = bound({
    id: "ctx:jvm-inferred",
    kind: "inferred",
    configPath: null,
    language: "java",
    digest: digestOf("jvm-inferred\nsrc/main/java\nsrc/test/java\nsrc/main/kotlin\nsrc/test/kotlin"),
  });
  if (jvm.length === 0) {
    jvmInferred.record.digest = digestOf("jvm-inferred\nsrc/main/java\nsrc/test/java\nsrc/main/kotlin\nsrc/test/kotlin");
  }

  const records = [
    ...python.map((project) => project.context.record),
    pythonInferred.record,
    ...jvm.map((module) => module.context.record),
    jvmInferred.record,
  ];

  return {
    python,
    jvm,
    pythonInferred,
    jvmInferred,
    records,
    workspacePackages,
    truncations: [...new Set(truncations)].slice(0, 32),
    files,
    directories: directoryIndex(files),
    inferredPythonRoots: srcPython ? ["src", ""] : [""],
    inferredJavaRoots: ["src/main/java", "src/test/java"],
    inferredKotlinRoots: ["src/main/kotlin", "src/test/kotlin"],
    contextFor(relativePath, language) {
      if (language === "py") {
        return nearest(relativePath, python)?.context ?? pythonInferred;
      }
      return nearest(relativePath, jvm)?.context ?? jvmInferred;
    },
  };
}
