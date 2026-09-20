import ts from "typescript";

export interface FilesystemHost {
  readFile(path: string): string | undefined;
  fileExists(path: string): boolean;
}

export function compilerApiVersion(): string {
  return `typescript@${ts.version}`;
}

export function hasCreateSourceFile(): boolean {
  return typeof ts.createSourceFile === "function";
}

export function hasResolveModuleName(): boolean {
  return typeof ts.resolveModuleName === "function";
}
