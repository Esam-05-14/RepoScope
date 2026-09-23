export interface DeclaredImport {
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

function scanCode(line: string): {
  code: string;
  parenDelta: number;
  triple: "'''" | '"""' | null;
  continued: boolean;
} {
  let code = "";
  let quote: "'" | '"' | null = null;
  let parenDelta = 0;
  let triple: "'''" | '"""' | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote !== null) {
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (line.startsWith("'''", index) || line.startsWith('"""', index)) {
      const marker = line.startsWith("'''", index) ? "'''" : '"""';
      const close = line.indexOf(marker, index + 3);
      if (close < 0) {
        triple = marker;
        break;
      }
      index = close + 2;
      continue;
    }
    if (char === "#") {
      break;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      parenDelta += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      parenDelta -= 1;
    }
    code += char ?? "";
  }
  const continued = /\\$/.test(line.trimEnd()) && triple === null && quote === null;
  return {
    code: continued ? code.replace(/\\$/, "") : code,
    parenDelta,
    triple,
    continued,
  };
}

function unsupported(
  specifier: string,
  start: number,
  end: number,
  edgeClass: "value" | "type",
): DeclaredImport {
  const trimmed = specifier.trim().slice(0, 1024);
  return {
    specifier: trimmed.length > 0 ? trimmed : "import",
    edgeClass,
    supported: false,
    reasonCode: "UNSUPPORTED_SYNTAX",
    syntaxKind: "other-unsupported",
    startOffset: start,
    endOffset: end,
  };
}

function splitCommas(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parsePyImport(
  statement: string,
  start: number,
  end: number,
  edgeClass: "value" | "type",
): DeclaredImport[] {
  if (statement.startsWith("import ")) {
    return splitCommas(statement.slice("import ".length)).map((part, index) => {
      const aliased = /^([A-Za-z_][\w.]*)(?:\s+as\s+([A-Za-z_]\w*))?$/.exec(part);
      if (aliased?.[1] === undefined) {
        return unsupported(part, start + index, end, edgeClass);
      }
      const binding = aliased[2] ?? aliased[1].split(".").pop();
      return {
        specifier: aliased[1],
        importedNames: binding !== undefined ? [binding] : undefined,
        edgeClass,
        supported: true,
        syntaxKind: "static-import",
        startOffset: start + index,
        endOffset: end,
      };
    });
  }
  const from = /^from\s+(\.+|\.+[A-Za-z_][\w.]*|[A-Za-z_][\w.]*)\s+import\s+(.+)$/.exec(statement);
  if (from?.[1] === undefined || from[2] === undefined) {
    return [unsupported(statement, start, end, edgeClass)];
  }
  let names = from[2].trim();
  if (names.startsWith("(") && names.endsWith(")")) {
    names = names.slice(1, -1).trim();
  }
  if (names === "*") {
    return [
      {
        specifier: from[1],
        importedNames: ["*"],
        edgeClass,
        supported: false,
        reasonCode: "WILDCARD_IMPORT",
        syntaxKind: "other-unsupported",
        startOffset: start,
        endOffset: end,
      },
    ];
  }
  const parts = splitCommas(names);
  const bindings: string[] = [];
  for (const part of parts) {
    const aliased = /^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/.exec(part);
    if (aliased?.[1] === undefined) {
      return [unsupported(statement, start, end, edgeClass)];
    }
    bindings.push(aliased[2] ?? aliased[1]);
  }
  if (/^\.+$/.test(from[1])) {
    return bindings.map((binding, index) => ({
      specifier: `${from[1]}${parts[index]?.split(/\s+as\s+/)[0]?.trim() ?? binding}`,
      importedNames: [binding],
      edgeClass,
      supported: true,
      syntaxKind: "static-import" as const,
      startOffset: start + index,
      endOffset: end,
    }));
  }
  return [
    {
      specifier: from[1],
      importedNames: bindings,
      edgeClass,
      supported: true,
      syntaxKind: "static-import",
      startOffset: start,
      endOffset: end,
    },
  ];
}

function isPythonModule(value: string): boolean {
  return /^[A-Za-z_][\w.]*$/.test(value) && !value.endsWith(".");
}

function dynamicImportsOnLine(
  line: string,
  lineStart: number,
  edgeClass: "value" | "type",
): DeclaredImport[] {
  const results: DeclaredImport[] = [];
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote !== null) {
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "#") {
      break;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    const head = line.startsWith("__import__", index) ? "__import__" : line.startsWith("importlib.import_module", index) ? "importlib.import_module" : undefined;
    if (head === undefined) {
      continue;
    }
    const before = line[index - 1];
    if (before !== undefined && /[A-Za-z0-9_]/.test(before)) {
      continue;
    }
    let cursor = index + head.length;
    while (cursor < line.length && /\s/.test(line[cursor] ?? "")) {
      cursor += 1;
    }
    if (line[cursor] !== "(") {
      continue;
    }
    const literal = /^\s*(['"])([^'"]+)\1/.exec(line.slice(cursor + 1));
    const name = literal?.[2];
    const named = name !== undefined && isPythonModule(name);
    results.push({
      specifier: named ? name : head === "__import__" ? "__import__" : "importlib",
      edgeClass,
      supported: named,
      reasonCode: named ? undefined : "UNSUPPORTED_SYNTAX",
      syntaxKind: "other-unsupported",
      startOffset: lineStart + index,
      endOffset: lineStart + line.length,
    });
    index = cursor;
  }
  return results;
}

export function extractPythonImports(text: string): DeclaredImport[] {
  const results: DeclaredImport[] = [];
  const lines = text.split("\n");
  let offset = 0;
  let triple: "'''" | '"""' | null = null;
  let paren = 0;
  let pending = "";
  let pendingStart = 0;
  let pendingIndent = 0;
  let inType = false;
  const typeIndents: number[] = [];

  const flush = (endOffset: number): void => {
    const statement = pending.replace(/\s+/g, " ").trim();
    const start = pendingStart;
    const edgeClass = inType ? "type" : "value";
    pending = "";
    paren = 0;
    if (statement.length === 0) {
      return;
    }
    const inlineType = /^if\s+(?:typing\.)?TYPE_CHECKING\b[^:]*:\s*(import\s+.+|from\s+.+)$/.exec(
      statement,
    );
    if (inlineType?.[1] !== undefined) {
      results.push(...parsePyImport(inlineType[1], start, endOffset, "type"));
      return;
    }
    if (/^if\s+(?:typing\.)?TYPE_CHECKING\b[^:]*:\s*$/.test(statement)) {
      typeIndents.push(pendingIndent);
      return;
    }
    if (statement.startsWith("import ") || statement.startsWith("from ")) {
      results.push(...parsePyImport(statement, start, endOffset, edgeClass));
    }
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;
    if (triple !== null) {
      if (line.includes(triple)) {
        triple = null;
      }
      continue;
    }
    const indent = /^[ \t]*/.exec(line)?.[0].length ?? 0;
    const scanned = scanCode(line);
    if (pending.length === 0 && scanned.code.trim().length === 0 && scanned.triple === null) {
      continue;
    }
    if (pending.length === 0) {
      while (typeIndents.length > 0 && indent <= (typeIndents[typeIndents.length - 1] ?? 0)) {
        typeIndents.pop();
      }
      pendingIndent = indent;
      pendingStart = lineStart + indent;
      inType = typeIndents.length > 0;
    }
    results.push(...dynamicImportsOnLine(line, lineStart, typeIndents.length > 0 ? "type" : "value"));
    pending += `${scanned.code} `;
    paren += scanned.parenDelta;
    if (scanned.triple !== null) {
      triple = scanned.triple;
    }
    if (triple === null && paren <= 0 && !scanned.continued) {
      flush(Math.max(pendingStart, offset - 1));
    }
  }
  if (pending.trim().length > 0 && triple === null) {
    flush(text.length);
  }
  return results;
}
