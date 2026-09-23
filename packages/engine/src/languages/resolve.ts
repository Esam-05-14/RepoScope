import type { ReasonCode, Resolution } from "@reposcope/contracts";
import { isUnder } from "./paths.js";
import type { JvmModule, LanguageModel, PythonProject } from "./model.js";

export interface DeclaredResolutionInput {
  language: "py" | "java" | "kt";
  specifier: string;
  supported: boolean;
  reasonCode?: ReasonCode;
  disposition?: "external";
  importerRelative: string;
  contextId: string;
  model: LanguageModel;
}

function nearest<T extends { directory: string }>(file: string, items: readonly T[]): T | undefined {
  return items
    .filter((item) => isUnder(file, item.directory))
    .sort((left, right) => right.directory.length - left.directory.length)[0];
}

function matchPython(base: string, files: ReadonlySet<string>): string | undefined {
  if (base.length === 0) {
    return undefined;
  }
  if (files.has(`${base}.py`)) {
    return `${base}.py`;
  }
  if (files.has(`${base}/__init__.py`)) {
    return `${base}/__init__.py`;
  }
  return undefined;
}

function prefixExists(
  roots: readonly string[],
  top: string,
  files: ReadonlySet<string>,
  directories: ReadonlySet<string>,
  suffixes: readonly string[],
): boolean {
  for (const root of roots) {
    const prefix = root.length === 0 ? top : `${root}/${top}`;
    if (directories.has(prefix)) {
      return true;
    }
    for (const suffix of suffixes) {
      if (files.has(`${prefix}${suffix}`)) {
        return true;
      }
    }
  }
  return false;
}

function internal(targetId: string, contextId: string): Resolution {
  return { status: "internal", targetId, contextId, reasonCode: "RESOLVED_INTERNAL" };
}

function external(name: string, contextId: string): Resolution {
  return { status: "external", externalName: name, contextId, reasonCode: "EXTERNAL_PACKAGE" };
}

function unresolved(contextId: string): Resolution {
  return { status: "unresolved", contextId, reasonCode: "UNRESOLVED_MODULE" };
}

function pythonRoots(model: LanguageModel, importer: string): string[] {
  const project: PythonProject | undefined = nearest(importer, model.python);
  return project?.roots ?? model.inferredPythonRoots;
}

function parentDir(directory: string): string | undefined {
  if (directory.length === 0) {
    return undefined;
  }
  const slash = directory.lastIndexOf("/");
  return slash < 0 ? "" : directory.slice(0, slash);
}

function resolvePython(input: DeclaredResolutionInput): Resolution {
  const roots = pythonRoots(input.model, input.importerRelative);
  if (input.specifier.startsWith(".")) {
    const match = /^(\.+)(.*)$/.exec(input.specifier);
    if (match?.[1] === undefined) {
      return unresolved(input.contextId);
    }
    let directory = input.importerRelative.includes("/")
      ? input.importerRelative.slice(0, input.importerRelative.lastIndexOf("/"))
      : "";
    for (let level = 1; level < match[1].length; level += 1) {
      const parent = parentDir(directory);
      if (parent === undefined) {
        return unresolved(input.contextId);
      }
      directory = parent;
    }
    const rest = (match[2] ?? "").replace(/^\./, "");
    const parts = rest.length > 0 ? rest.split(".").filter((part) => part.length > 0) : [];
    const base = [...(directory.length > 0 ? directory.split("/") : []), ...parts].join("/");
    const hit = matchPython(base, input.model.files);
    return hit !== undefined ? internal(hit, input.contextId) : unresolved(input.contextId);
  }
  const parts = input.specifier.split(".").filter((part) => part.length > 0);
  if (parts.length === 0 || parts.some((part) => !/^[A-Za-z_]\w*$/.test(part))) {
    return unresolved(input.contextId);
  }
  for (const root of roots) {
    const base = [...(root.length > 0 ? root.split("/") : []), ...parts].join("/");
    const hit = matchPython(base, input.model.files);
    if (hit !== undefined) {
      return internal(hit, input.contextId);
    }
  }
  const top = parts[0];
  if (top !== undefined && prefixExists(roots, top, input.model.files, input.model.directories, [".py"])) {
    return unresolved(input.contextId);
  }
  return external(input.specifier, input.contextId);
}

function jvmRoots(model: LanguageModel, importer: string, language: "java" | "kt"): string[] {
  if (model.jvm.length === 0) {
    return language === "kt"
      ? [...model.inferredKotlinRoots, ...model.inferredJavaRoots]
      : [...model.inferredJavaRoots, ...model.inferredKotlinRoots];
  }
  const own: JvmModule | undefined = nearest(importer, model.jvm);
  const rest = model.jvm.filter((module) => module !== own);
  const ordered = own !== undefined ? [own, ...rest] : rest;
  const roots: string[] = [];
  for (const module of ordered) {
    if (language === "kt") {
      roots.push(...module.kotlinRoots, ...module.javaRoots);
    } else {
      roots.push(...module.javaRoots, ...module.kotlinRoots);
    }
  }
  return roots;
}

function resolveJvm(input: DeclaredResolutionInput, language: "java" | "kt"): Resolution {
  const parts = input.specifier.split(".").filter((part) => part.length > 0);
  if (parts.length === 0 || parts.some((part) => !/^[A-Za-z_]\w*$/.test(part))) {
    return unresolved(input.contextId);
  }
  const relative = parts.join("/");
  const roots = jvmRoots(input.model, input.importerRelative, language);
  const extensions = language === "kt" ? [".kt", ".java"] : [".java", ".kt"];
  for (const root of roots) {
    for (const extension of extensions) {
      const candidate = root.length === 0 ? `${relative}${extension}` : `${root}/${relative}${extension}`;
      if (input.model.files.has(candidate)) {
        return internal(candidate, input.contextId);
      }
    }
  }
  const top = parts[0];
  if (
    top !== undefined &&
    prefixExists(roots, top, input.model.files, input.model.directories, extensions)
  ) {
    return unresolved(input.contextId);
  }
  return external(input.specifier, input.contextId);
}

export function resolveDeclared(input: DeclaredResolutionInput): Resolution {
  if (input.disposition === "external") {
    return external(input.specifier, input.contextId);
  }
  if (!input.supported) {
    return {
      status: "unsupported",
      contextId: input.contextId,
      reasonCode: input.reasonCode ?? "UNSUPPORTED_SYNTAX",
    };
  }
  if (input.specifier.length === 0 || input.specifier.length > 1024) {
    return {
      status: "unsupported",
      contextId: input.contextId,
      reasonCode: "UNSUPPORTED_SYNTAX",
    };
  }
  if (input.language === "py") {
    return resolvePython(input);
  }
  return resolveJvm(input, input.language === "kt" ? "kt" : "java");
}
