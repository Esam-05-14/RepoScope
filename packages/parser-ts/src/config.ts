import path from "node:path";
import ts from "typescript";
import type { FilesystemHost } from "./host.js";

export interface ParsedProjectConfig {
  fileName: string;
  options: ts.CompilerOptions;
  extendsOutsideRoot: boolean;
  fileNames: string[];
  references: string[];
}

const SKIP_CONFIG_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", "out"]);

function collectMatchingFiles(
  host: FilesystemHost,
  directory: string,
  extensions: readonly string[],
  acc: string[],
  depth: number,
): void {
  if (depth > 24) {
    return;
  }
  const names = host.readDirectory?.(directory) ?? [];
  for (const name of names) {
    if (SKIP_CONFIG_DIRS.has(name)) {
      continue;
    }
    const absolute = path.join(directory, name);
    if (host.directoryExists?.(absolute) === true) {
      collectMatchingFiles(host, absolute, extensions, acc, depth + 1);
      continue;
    }
    if (extensions.some((extension) => name.endsWith(extension))) {
      acc.push(absolute);
    }
  }
}

function toModuleHost(host: FilesystemHost): ts.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: true,
    readDirectory: (rootDir, extensions, excludes, includes, depth) => {
      void excludes;
      void includes;
      void depth;
      const acc: string[] = [];
      collectMatchingFiles(
        host,
        rootDir,
        extensions.length > 0 ? extensions : [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"],
        acc,
        0,
      );
      return acc;
    },
    fileExists: (file) => host.fileExists(file),
    readFile: (file) => host.readFile(file),
  };
}

export function parseProjectConfig(
  configPath: string,
  host: FilesystemHost,
): ParsedProjectConfig {
  const text = host.readFile(configPath);
  if (text === undefined) {
    throw new Error(`config not readable: ${configPath}`);
  }
  const parsed = ts.parseConfigFileTextToJson(configPath, text);
  const configDir = path.dirname(configPath);
  const converted = ts.parseJsonConfigFileContent(
    parsed.config,
    toModuleHost(host),
    configDir,
    undefined,
    configPath,
  );
  const extendsRaw =
    parsed.config !== undefined &&
    typeof parsed.config === "object" &&
    parsed.config !== null &&
    "extends" in parsed.config
      ? String((parsed.config as { extends?: unknown }).extends ?? "")
      : "";
  let extendsOutsideRoot = false;
  if (extendsRaw !== "") {
    const extendsPath = path.resolve(configDir, extendsRaw);
    if (host.fileExists(extendsPath) === false && host.readFile(extendsPath) === undefined) {
      extendsOutsideRoot = !extendsRaw.startsWith(".")
        ? false
        : host.fileExists(extendsPath) === false;
    }
  }
  const references: string[] = [];
  const raw =
    parsed.config !== undefined && typeof parsed.config === "object" && parsed.config !== null
      ? (parsed.config as { references?: { path?: unknown }[] })
      : undefined;
  const listed = raw?.references;
  if (Array.isArray(listed)) {
    for (const reference of listed) {
      if (typeof reference?.path !== "string" || reference.path === "") {
        continue;
      }
      const resolved = path.resolve(configDir, reference.path);
      if (host.fileExists(resolved)) {
        references.push(resolved);
        continue;
      }
      const asConfig = path.join(resolved, "tsconfig.json");
      if (host.fileExists(asConfig)) {
        references.push(asConfig);
      }
    }
  }
  return {
    fileName: configPath,
    options: converted.options,
    extendsOutsideRoot,
    fileNames: converted.fileNames,
    references,
  };
}

export function inferredCompilerOptions(): ts.CompilerOptions {
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
  };
}
