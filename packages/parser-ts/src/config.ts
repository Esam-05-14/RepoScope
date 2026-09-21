import path from "node:path";
import ts from "typescript";
import type { FilesystemHost } from "./host.js";

export interface ParsedProjectConfig {
  fileName: string;
  options: ts.CompilerOptions;
  extendsOutsideRoot: boolean;
}

function toModuleHost(host: FilesystemHost): ts.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: true,
    readDirectory: (rootDir, extensions, excludes, includes, depth) => {
      void extensions;
      void excludes;
      void includes;
      void depth;
      return host.readDirectory?.(rootDir) ?? [];
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
  return {
    fileName: configPath,
    options: converted.options,
    extendsOutsideRoot,
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
