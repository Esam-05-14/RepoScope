import ts from "typescript";
import type { TsLanguageId } from "@reposcope/contracts";

const EXTENSIONS: Record<string, TsLanguageId> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mts": "mts",
  ".cts": "cts",
  ".mjs": "mjs",
  ".cjs": "cjs",
};

export function languageFromPath(fileName: string): TsLanguageId | undefined {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return EXTENSIONS[ext];
}

export function scriptKindFor(language: TsLanguageId): ts.ScriptKind {
  switch (language) {
    case "tsx":
      return ts.ScriptKind.TSX;
    case "jsx":
      return ts.ScriptKind.JSX;
    case "js":
    case "mjs":
    case "cjs":
      return ts.ScriptKind.JS;
    case "ts":
    case "mts":
    case "cts":
      return ts.ScriptKind.TS;
  }
}

export const SOURCE_EXTENSIONS = new Set(Object.keys(EXTENSIONS));
