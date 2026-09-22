import ts from "typescript";
import type { EdgeClass, SourceRange, SyntaxKind } from "@reposcope/contracts";

export interface ExtractedConstruct {
  specifier: string;
  syntaxKind: SyntaxKind;
  edgeClass: EdgeClass;
  supported: boolean;
  range: SourceRange;
  importedNames?: string[];
  sideEffect?: boolean;
}

const NAME_CAP = 64;
const NAME_LEN = 256;

function capNames(names: readonly string[]): string[] | undefined {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (name.length === 0 || name.length > NAME_LEN || seen.has(name)) {
      continue;
    }
    seen.add(name);
    unique.push(name);
    if (unique.length >= NAME_CAP) {
      break;
    }
  }
  return unique.length === 0 ? undefined : unique;
}

function importedNamesFromImport(node: ts.ImportDeclaration): string[] | undefined {
  const clause = node.importClause;
  if (clause === undefined) {
    return undefined;
  }
  const names: string[] = [];
  if (clause.name !== undefined) {
    names.push(clause.name.text);
  }
  const bindings = clause.namedBindings;
  if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
    names.push(bindings.name.text);
  } else if (bindings !== undefined && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      names.push(element.name.text);
    }
  }
  return capNames(names);
}

function importedNamesFromExport(node: ts.ExportDeclaration): string[] | undefined {
  if (node.exportClause === undefined) {
    return capNames(["*"]);
  }
  if (ts.isNamespaceExport(node.exportClause)) {
    return capNames([node.exportClause.name.text]);
  }
  if (ts.isNamedExports(node.exportClause)) {
    return capNames(node.exportClause.elements.map((element) => element.name.text));
  }
  return undefined;
}

function rangeOf(sourceFile: ts.SourceFile, node: ts.Node): SourceRange {
  const startOffset = node.getStart(sourceFile);
  const endOffset = node.getEnd();
  const start = sourceFile.getLineAndCharacterOfPosition(startOffset);
  const end = sourceFile.getLineAndCharacterOfPosition(endOffset);
  return {
    startOffset,
    endOffset,
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

function stringLiteral(node: ts.Expression | ts.DeclarationName | undefined): string | undefined {
  if (node !== undefined && ts.isStringLiteralLike(node)) {
    return node.text;
  }
  return undefined;
}

function namedTypeMix(
  elements: readonly ts.ImportSpecifier[] | readonly ts.ExportSpecifier[],
): { anyType: boolean; anyValue: boolean } {
  let anyType = false;
  let anyValue = false;
  for (const element of elements) {
    if (element.isTypeOnly) {
      anyType = true;
    } else {
      anyValue = true;
    }
  }
  return { anyType, anyValue };
}

function classifyImport(node: ts.ImportDeclaration): {
  syntaxKind: SyntaxKind;
  edgeClass: EdgeClass;
} {
  const clause = node.importClause;
  if (clause?.isTypeOnly === true) {
    return { syntaxKind: "type-only-import", edgeClass: "type" };
  }
  const named = clause?.namedBindings;
  if (named !== undefined && ts.isNamedImports(named)) {
    const mix = namedTypeMix(named.elements);
    if (mix.anyType && mix.anyValue) {
      return { syntaxKind: "mixed-import", edgeClass: "mixed" };
    }
    if (mix.anyType && !mix.anyValue && clause?.name === undefined) {
      return { syntaxKind: "type-only-import", edgeClass: "type" };
    }
  }
  return { syntaxKind: "static-import", edgeClass: "value" };
}

function classifyExportFrom(node: ts.ExportDeclaration): {
  syntaxKind: SyntaxKind;
  edgeClass: EdgeClass;
} {
  if (node.isTypeOnly) {
    return { syntaxKind: "type-only-export-from", edgeClass: "type" };
  }
  if (node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
    const mix = namedTypeMix(node.exportClause.elements);
    if (mix.anyType && mix.anyValue) {
      return { syntaxKind: "mixed-export-from", edgeClass: "mixed" };
    }
    if (mix.anyType && !mix.anyValue) {
      return { syntaxKind: "type-only-export-from", edgeClass: "type" };
    }
  }
  return { syntaxKind: "export-from", edgeClass: "value" };
}

export function extractConstructs(sourceFile: ts.SourceFile): ExtractedConstruct[] {
  const found: ExtractedConstruct[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const specifier = stringLiteral(node.moduleSpecifier);
      if (specifier !== undefined) {
        const classified = classifyImport(node);
        found.push({
          specifier,
          ...classified,
          supported:
            classified.syntaxKind === "static-import" ||
            classified.syntaxKind === "type-only-import" ||
            classified.syntaxKind === "mixed-import",
          range: rangeOf(sourceFile, node),
          importedNames: importedNamesFromImport(node),
          sideEffect: node.importClause === undefined,
        });
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      const specifier = stringLiteral(node.moduleSpecifier);
      if (specifier !== undefined) {
        const classified = classifyExportFrom(node);
        found.push({
          specifier,
          ...classified,
          supported:
            classified.syntaxKind === "export-from" ||
            classified.syntaxKind === "type-only-export-from" ||
            classified.syntaxKind === "mixed-export-from",
          range: rangeOf(sourceFile, node),
          importedNames: importedNamesFromExport(node),
        });
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      let specifier = "unknown";
      if (ts.isExternalModuleReference(node.moduleReference)) {
        specifier = stringLiteral(node.moduleReference.expression) ?? "unknown";
      }
      found.push({
        specifier,
        syntaxKind: "import-equals",
        edgeClass: "value",
        supported: false,
        range: rangeOf(sourceFile, node),
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const specifier = stringLiteral(node.arguments[0]);
      found.push({
        specifier: specifier ?? "unknown",
        syntaxKind: "dynamic-import",
        edgeClass: "value",
        supported: false,
        range: rangeOf(sourceFile, node),
      });
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      const specifier = stringLiteral(node.arguments[0]);
      found.push({
        specifier: specifier ?? "unknown",
        syntaxKind: "require",
        edgeClass: "value",
        supported: specifier !== undefined,
        range: rangeOf(sourceFile, node),
      });
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      const specifier =
        ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)
          ? argument.literal.text
          : undefined;
      found.push({
        specifier: specifier ?? "unknown",
        syntaxKind: "other-unsupported",
        edgeClass: "type",
        supported: false,
        range: rangeOf(sourceFile, node),
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  for (const reference of sourceFile.referencedFiles) {
    const start = sourceFile.getLineAndCharacterOfPosition(reference.pos);
    const end = sourceFile.getLineAndCharacterOfPosition(reference.end);
    found.push({
      specifier: reference.fileName,
      syntaxKind: "triple-slash-path",
      edgeClass: "value",
      supported: true,
      range: {
        startOffset: reference.pos,
        endOffset: reference.end,
        startLine: start.line + 1,
        startColumn: start.character + 1,
        endLine: end.line + 1,
        endColumn: end.character + 1,
      },
    });
  }
  return found;
}
