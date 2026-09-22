import type { SourceRange } from "@reposcope/contracts";

function positionAt(text: string, offset: number): { line: number; column: number } {
  let line = 0;
  let column = 0;
  const end = Math.max(0, Math.min(offset, text.length));
  for (let index = 0; index < end; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function offsetsToRange(text: string, start: number, end: number): SourceRange {
  const startOffset = Math.max(0, Math.min(start, text.length));
  const endOffset = Math.max(startOffset, Math.min(end, text.length));
  const startPos = positionAt(text, startOffset);
  const endPos = positionAt(text, endOffset);
  return {
    startOffset,
    endOffset,
    startLine: startPos.line,
    startColumn: startPos.column,
    endLine: endPos.line,
    endColumn: endPos.column,
  };
}
