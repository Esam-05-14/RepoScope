function includeToRelative(raw: string): string | undefined {
  const body = raw.startsWith(":") ? raw.slice(1) : raw;
  if (body.length === 0 || body.includes("..") || body.includes("/") || body.includes("\\")) {
    return undefined;
  }
  if (!/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/.test(body)) {
    return undefined;
  }
  const parts = body.split(":");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    return undefined;
  }
  return parts.join("/");
}

function stripGradle(text: string): string {
  let code = "";
  let index = 0;
  while (index < text.length) {
    if (text.startsWith("//", index)) {
      const end = text.indexOf("\n", index);
      index = end < 0 ? text.length : end;
      code += "\n";
      continue;
    }
    if (text.startsWith("/*", index)) {
      const end = text.indexOf("*/", index + 2);
      index = end < 0 ? text.length : end + 2;
      code += " ";
      continue;
    }
    const char = text[index];
    if (char === '"' || char === "'") {
      const quote = char;
      let end = index + 1;
      while (end < text.length && text[end] !== quote) {
        if (text[end] === "\\") {
          end += 2;
          continue;
        }
        end += 1;
      }
      code += text.slice(index, Math.min(text.length, end + 1));
      index = Math.min(text.length, end + 1);
      continue;
    }
    code += char ?? "";
    index += 1;
  }
  return code;
}

export function extractGradleIncludes(text: string): { directories: string[]; rejected: boolean } {
  const dirs: string[] = [];
  let rejected = false;
  const code = stripGradle(text);
  for (const match of code.matchAll(/\binclude\s*\(([^)]*)\)/g)) {
    const body = match[1] ?? "";
    for (const literal of body.matchAll(/"([^"\\]*)"|'([^'\\]*)'/g)) {
      const raw = literal[1] ?? literal[2] ?? "";
      const dir = includeToRelative(raw);
      if (dir === undefined) {
        if (raw.length > 0) {
          rejected = true;
        }
        continue;
      }
      dirs.push(dir);
    }
  }
  return { directories: [...new Set(dirs)], rejected };
}
