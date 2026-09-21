import ts from "typescript";
import type { FilesystemHost } from "./host.js";

function toResolutionHost(host: FilesystemHost): ts.ModuleResolutionHost {
  return {
    fileExists: (fileName) => host.fileExists(fileName),
    readFile: (fileName) => host.readFile(fileName),
    directoryExists: (directoryName) => host.directoryExists?.(directoryName) ?? true,
    realpath: (fileName) => host.realpath?.(fileName) ?? fileName,
    getCurrentDirectory: () => host.getCurrentDirectory?.() ?? "",
    getDirectories: (directoryName) => host.readDirectory?.(directoryName) ?? [],
  };
}

export function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

export function resolveSpecifier(input: {
  specifier: string;
  containingFile: string;
  options: ts.CompilerOptions;
  host: FilesystemHost;
}): string | undefined {
  const resolved = ts.resolveModuleName(
    input.specifier,
    input.containingFile,
    input.options,
    toResolutionHost(input.host),
  );
  return resolved.resolvedModule?.resolvedFileName;
}
