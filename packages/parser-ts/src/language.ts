import ts from "typescript";
import type { LanguageId } from "@reposcope/contracts";

const EXTENSIONS: Record<string, LanguageId> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mts": "mts",
  ".cts": "cts",
  ".mjs": "mjs",
  ".cjs": "cjs",
};

export function languageFromPath(fileName: string): LanguageId | undefined {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return EXTENSIONS[ext];
}

export function scriptKindFor(language: LanguageId): ts.ScriptKind {
  switch (language) {
    case "tsx":
      return ts.ScriptKind.TSX;
    case "jsx":
      return ts.ScriptKind.JSX;
    case "js":
    case "mjs":
    case "cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

export const SOURCE_EXTENSIONS = new Set(Object.keys(EXTENSIONS));
