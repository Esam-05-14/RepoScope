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

function isIdent(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char);
}

function isWord(text: string, index: number, word: string): boolean {
  if (!text.startsWith(word, index)) {
    return false;
  }
  return !isIdent(text[index - 1]) && !isIdent(text[index + word.length]);
}

function skipString(text: string, index: number): number {
  if (text.startsWith('"""', index)) {
    const end = text.indexOf('"""', index + 3);
    return end < 0 ? text.length : end + 3;
  }
  const quote = text[index];
  let cursor = index + 1;
  while (cursor < text.length) {
    if (text[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (text[cursor] === quote) {
      return cursor + 1;
    }
    if (text[cursor] === "\n") {
      return cursor;
    }
    cursor += 1;
  }
  return text.length;
}

function parseKotlinClause(clause: string, start: number, end: number): DeclaredImport {
  const trimmed = clause.trim();
  const wildcard = /^import\s+([A-Za-z_][\w.]*)\.\*$/.exec(trimmed);
  if (wildcard?.[1] !== undefined) {
    return {
      specifier: `${wildcard[1]}.*`,
      edgeClass: "value",
      supported: false,
      reasonCode: "WILDCARD_IMPORT",
      syntaxKind: "other-unsupported",
      startOffset: start,
      endOffset: end,
    };
  }
  const named = /^import\s+([A-Za-z_][\w.]*)(?:\s+as\s+([A-Za-z_]\w*))?$/.exec(trimmed);
  if (named?.[1] === undefined) {
    return {
      specifier: trimmed.slice(0, 1024) || "import",
      edgeClass: "value",
      supported: false,
      reasonCode: "UNSUPPORTED_SYNTAX",
      syntaxKind: "other-unsupported",
      startOffset: start,
      endOffset: end,
    };
  }
  return {
    specifier: named[1],
    importedNames: named[2] !== undefined ? [named[2]] : undefined,
    edgeClass: "value",
    supported: true,
    syntaxKind: "static-import",
    startOffset: start,
    endOffset: end,
  };
}

function parseKotlinSpring(text: string, index: number, found: DeclaredImport[]): number {
  const header = /^@(?:Import|ComponentScan|SpringBootApplication)\b/.exec(text.slice(index, index + 80));
  if (header === null) {
    return index;
  }
  let cursor = index + header[0].length;
  while (cursor < text.length && /\s/.test(text[cursor] ?? "")) {
    cursor += 1;
  }
  if (text[cursor] !== "(") {
    return cursor;
  }
  let depth = 1;
  const bodyStart = cursor + 1;
  cursor += 1;
  const limit = Math.min(text.length, bodyStart + 4000);
  while (cursor < limit && depth > 0) {
    if (text[cursor] === "(") {
      depth += 1;
    } else if (text[cursor] === ")") {
      depth -= 1;
    }
    cursor += 1;
  }
  const body = text.slice(bodyStart, Math.max(bodyStart, cursor - 1));
  for (const match of body.matchAll(/([A-Za-z_][\w.]*(?:\.[A-Za-z_][\w.]*)+)(?:::class)?\.class\b|([A-Za-z_][\w.]*(?:\.[A-Za-z_][\w.]*)+)::class\b/g)) {
    const specifier = match[1] ?? match[2];
    if (specifier === undefined || !specifier.includes(".")) {
      continue;
    }
    const at = bodyStart + (match.index ?? 0);
    found.push({
      specifier,
      edgeClass: "value",
      supported: true,
      syntaxKind: "static-import",
      startOffset: at,
      endOffset: at + specifier.length,
    });
  }
  return cursor;
}

export function extractKotlinImports(text: string): DeclaredImport[] {
  const found: DeclaredImport[] = [];
  let index = 0;
  while (index < text.length) {
    if (text.startsWith("//", index)) {
      const end = text.indexOf("\n", index);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith("/*", index)) {
      const end = text.indexOf("*/", index + 2);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    if (text[index] === '"' || text[index] === "'") {
      index = skipString(text, index);
      continue;
    }
    if (isWord(text, index, "package")) {
      const end = text.indexOf("\n", index);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text[index] === "@") {
      const next = parseKotlinSpring(text, index, found);
      if (next > index) {
        index = next;
        continue;
      }
    }
    if (isWord(text, index, "Class")) {
      const slice = text.slice(index, index + 160);
      const call = /^Class\s*\.\s*forName\s*\(/.exec(slice);
      if (call !== null) {
        const after = index + call[0].length;
        const literal = /^(\s*)(["'])([^"']*)\2/.exec(text.slice(after));
        const named = literal?.[3] !== undefined && /^[A-Za-z_][\w.]*(?:\.[A-Za-z_][\w.]*)+$/.test(literal[3]);
        const end = literal !== null ? after + literal[0].length : after;
        found.push({
          specifier: named ? (literal?.[3] ?? "Class.forName") : "Class.forName",
          edgeClass: "value",
          supported: named,
          reasonCode: named ? undefined : "UNSUPPORTED_SYNTAX",
          syntaxKind: "other-unsupported",
          startOffset: index,
          endOffset: end,
        });
        index = end;
        continue;
      }
    }
    if (isWord(text, index, "import")) {
      let end = index + "import".length;
      while (end < text.length && text[end] !== "\n" && text[end] !== ";") {
        if (text.startsWith("//", end)) {
          break;
        }
        end += 1;
      }
      found.push(parseKotlinClause(text.slice(index, end), index, end));
      index = text[end] === ";" ? end + 1 : end;
      continue;
    }
    index += 1;
  }
  return found;
}
