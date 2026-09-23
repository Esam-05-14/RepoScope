import { createHash } from "node:crypto";
import type { ImportObservation, ReasonCode } from "@reposcope/contracts";
import { extractJavaImports } from "@reposcope/parser-java";
import { extractKotlinImports } from "@reposcope/parser-kt";
import { extractNotebookImports, extractPythonImports } from "@reposcope/parser-py";
import type { LanguageModel } from "./model.js";
import { offsetsToRange } from "./ranges.js";
import { resolveDeclared } from "./resolve.js";

interface ExtractedImport {
  specifier: string;
  importedNames?: string[];
  edgeClass: "value" | "type";
  supported: boolean;
  reasonCode?: "WILDCARD_IMPORT" | "UNSUPPORTED_SYNTAX";
  syntaxKind: "static-import" | "other-unsupported";
  startOffset: number;
  endOffset: number;
  disposition?: "external";
}

const MAX_OBSERVATIONS = 512;

function observationId(relativePath: string, startOffset: number, salt: number): string {
  const natural =
    salt === 0
      ? `obs:${relativePath}:${startOffset}`
      : `obs:${relativePath}:${startOffset}:${salt}`;
  if (natural.length <= 128) {
    return natural;
  }
  return `obs:${createHash("sha256").update(natural, "utf8").digest("hex").slice(0, 40)}`;
}

function extract(language: "py" | "java" | "kt", text: string): ExtractedImport[] {
  if (language === "py") {
    return extractPythonImports(text);
  }
  if (language === "java") {
    return extractJavaImports(text);
  }
  return extractKotlinImports(text);
}

export function collectForeignObservations(input: {
  text: string;
  language: "py" | "java" | "kt";
  relativePath: string;
  contextId: string;
  model: LanguageModel;
}): { observations: ImportObservation[]; truncated: boolean; notebookRejected: boolean } {
  const bom = input.text.charCodeAt(0) === 0xfeff;
  const text = bom ? input.text.slice(1) : input.text;
  const notebook =
    input.language === "py" && input.relativePath.endsWith(".ipynb")
      ? extractNotebookImports(text)
      : undefined;
  const extracted = notebook !== undefined ? notebook.imports : extract(input.language, text);
  const truncated = extracted.length > MAX_OBSERVATIONS;
  const observations: ImportObservation[] = [];
  const seen = new Set<string>();
  for (const item of extracted.slice(0, MAX_OBSERVATIONS)) {
    const specifier = item.specifier.trim().replaceAll("\0", "").slice(0, 1024);
    if (specifier.length === 0) {
      continue;
    }
    const resolution = resolveDeclared({
      language: input.language,
      specifier,
      supported: item.supported,
      reasonCode: item.reasonCode as ReasonCode | undefined,
      disposition: item.disposition,
      importerRelative: input.relativePath,
      contextId: input.contextId,
      model: input.model,
    });
    let salt = 0;
    let id = observationId(input.relativePath, item.startOffset, salt);
    while (seen.has(id)) {
      salt += 1;
      id = observationId(input.relativePath, item.startOffset, salt);
    }
    seen.add(id);
    const shift = bom ? 1 : 0;
    observations.push({
      id,
      importerId: input.relativePath,
      specifier,
      syntaxKind: item.syntaxKind,
      edgeClass: item.edgeClass,
      range: offsetsToRange(input.text, item.startOffset + shift, item.endOffset + shift),
      resolution,
      importedNames: item.importedNames?.slice(0, 64),
    });
  }
  return { observations, truncated, notebookRejected: notebook?.rejected === true };
}
