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

function parseJavaClause(clause: string, start: number, end: number): DeclaredImport {
  const trimmed = clause.trim();
  const wildcard = /^import\s+(?:static\s+)?([A-Za-z_][\w.]*)\.\*\s*;$/.exec(trimmed);
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
  const named = /^import\s+(?:(static)\s+)?([A-Za-z_][\w.]*)\s*;$/.exec(trimmed);
  if (named?.[2] === undefined) {
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
  let specifier = named[2];
  let importedNames: string[] | undefined;
  if (named[1] === "static") {
    const parts = specifier.split(".");
    const member = parts.pop();
    specifier = parts.join(".");
    if (member !== undefined && specifier.length > 0) {
      importedNames = [member];
    }
  }
  return {
    specifier,
    importedNames,
    edgeClass: "value",
    supported: true,
    syntaxKind: "static-import",
    startOffset: start,
    endOffset: end,
  };
}

function parseModule(text: string, index: number, found: DeclaredImport[]): number {
  const open = text.indexOf("{", index);
  if (open < 0) {
    return index + "module".length;
  }
  let depth = 1;
  let cursor = open + 1;
  const limit = Math.min(text.length, open + 65536);
  while (cursor < limit && depth > 0) {
    if (text.startsWith("//", cursor)) {
      const end = text.indexOf("\n", cursor);
      cursor = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith("/*", cursor)) {
      const end = text.indexOf("*/", cursor + 2);
      cursor = end < 0 ? text.length : end + 2;
      continue;
    }
    if (text[cursor] === '"' || text[cursor] === "'") {
      cursor = skipString(text, cursor);
      continue;
    }
    if (text[cursor] === "{") {
      depth += 1;
      cursor += 1;
      continue;
    }
    if (text[cursor] === "}") {
      depth -= 1;
      cursor += 1;
      continue;
    }
    if (depth === 1 && isWord(text, cursor, "requires")) {
      const start = cursor;
      const slice = text.slice(cursor, Math.min(text.length, cursor + 200));
      const match = /^requires\s+(?:(?:transitive|static)\s+)*([A-Za-z_][\w.]*)\s*;/.exec(slice);
      if (match?.[1] !== undefined) {
        found.push({
          specifier: match[1],
          edgeClass: "value",
          supported: true,
          syntaxKind: "other-unsupported",
          disposition: "external",
          startOffset: start,
          endOffset: start + match[0].length,
        });
        cursor = start + match[0].length;
        continue;
      }
    }
    cursor += 1;
  }
  return cursor;
}

function parseCall(
  text: string,
  index: number,
  found: DeclaredImport[],
  word: string,
  pattern: RegExp,
  fallback: string,
): number {
  const slice = text.slice(index, index + 160);
  const match = pattern.exec(slice);
  if (match === null) {
    return index + word.length;
  }
  const after = index + match[0].length;
  const literal = /^(\s*)(["'])([^"']*)\2/.exec(text.slice(after));
  const specifier = literal?.[3] !== undefined && literal[3].length > 0 ? literal[3] : fallback;
  const end = literal !== null ? after + literal[0].length : after;
  found.push({
    specifier: specifier.slice(0, 1024),
    edgeClass: "value",
    supported: false,
    reasonCode: "UNSUPPORTED_SYNTAX",
    syntaxKind: "other-unsupported",
    startOffset: index,
    endOffset: end,
  });
  return end;
}

export function extractJavaImports(text: string): DeclaredImport[] {
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
    if (isWord(text, index, "import")) {
      const end = text.indexOf(";", index);
      if (end < 0) {
        break;
      }
      found.push(parseJavaClause(text.slice(index, end + 1), index, end + 1));
      index = end + 1;
      continue;
    }
    if (isWord(text, index, "package")) {
      const end = text.indexOf(";", index);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (isWord(text, index, "module")) {
      index = parseModule(text, index, found);
      continue;
    }
    if (isWord(text, index, "Class")) {
      index = parseCall(text, index, found, "Class", /^Class\s*\.\s*forName\s*\(/, "Class.forName");
      continue;
    }
    if (isWord(text, index, "ServiceLoader")) {
      index = parseCall(
        text,
        index,
        found,
        "ServiceLoader",
        /^ServiceLoader\s*\.\s*load\s*\(/,
        "ServiceLoader.load",
      );
      continue;
    }
    index += 1;
  }
  return found;
}
