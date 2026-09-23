import { extractPythonImports, type DeclaredImport } from "./extract.js";

const MAX_CELLS = 200;
const MAX_CELL_CHARS = 65_536;

function cellSource(source: unknown): string {
  if (typeof source === "string") {
    return source;
  }
  if (!Array.isArray(source)) {
    return "";
  }
  return source.filter((line): line is string => typeof line === "string").join("");
}

export function extractNotebookImports(raw: string): { imports: DeclaredImport[]; rejected: boolean } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { imports: [], rejected: true };
  }
  if (typeof parsed !== "object" || parsed === null || !("cells" in parsed)) {
    return { imports: [], rejected: true };
  }
  const cells = (parsed as { cells?: unknown }).cells;
  if (!Array.isArray(cells)) {
    return { imports: [], rejected: true };
  }
  const imports: DeclaredImport[] = [];
  let searchFrom = 0;
  for (const cell of cells.slice(0, MAX_CELLS)) {
    if (typeof cell !== "object" || cell === null) {
      continue;
    }
    const record = cell as { cell_type?: unknown; source?: unknown };
    if (record.cell_type !== "code") {
      continue;
    }
    const source = cellSource(record.source);
    if (source.length === 0 || source.length > MAX_CELL_CHARS) {
      continue;
    }
    for (const item of extractPythonImports(source)) {
      const at = raw.indexOf(item.specifier, searchFrom);
      const start = at >= 0 ? at : 0;
      if (at >= 0) {
        searchFrom = at + item.specifier.length;
      }
      imports.push({
        ...item,
        startOffset: start,
        endOffset: start + (at >= 0 ? item.specifier.length : 0),
      });
    }
  }
  return { imports, rejected: false };
}
