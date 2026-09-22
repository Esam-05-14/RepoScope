import ts from "typescript";
import type { TsLanguageId } from "@reposcope/contracts";
import { scriptKindFor } from "./language.js";

export function parseSourceFile(
  fileName: string,
  text: string,
  language: TsLanguageId,
): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(language),
  );
}

export function parseDiagnostics(sourceFile: ts.SourceFile): readonly ts.Diagnostic[] {
  const withParse = sourceFile as ts.SourceFile & {
    parseDiagnostics?: readonly ts.Diagnostic[];
  };
  return withParse.parseDiagnostics ?? [];
}
