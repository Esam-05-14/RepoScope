export interface PythonLayout {
  name?: string;
  /** Present only when the file declares source roots. */
  roots?: string[];
}

function stripTomlComment(line: string): string {
  let quote: '"' | "'" | null = null;
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
      return line.slice(0, index);
    }
    if (char === '"' || char === "'") {
      quote = char;
    }
  }
  return line;
}

function unquote(value: string): string | undefined {
  const match = /^(['"])(.*)\1$/.exec(value.trim());
  return match?.[2];
}

function readStringArray(value: string): string[] | undefined {
  const names = [...value.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1] ?? "");
  const cleaned = names.map((name) => name.trim()).filter((name) => name.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function readPackageDir(value: string): string | undefined {
  const match = /['"]{2}\s*=\s*['"]([^'"]+)['"]/.exec(value);
  return match?.[1]?.trim();
}

export function readPyProject(text: string): PythonLayout {
  let section = "";
  let name: string | undefined;
  let where: string[] | undefined;
  let packageDir: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = stripTomlComment(raw).trim();
    if (line.length === 0) {
      continue;
    }
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header?.[1] !== undefined) {
      section = header[1].trim();
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line);
    if (pair?.[1] === undefined || pair[2] === undefined) {
      continue;
    }
    if (section === "project" && pair[1] === "name") {
      name = unquote(pair[2]) ?? pair[2].trim();
    }
    if (section === "tool.setuptools.packages.find" && pair[1] === "where") {
      where = readStringArray(pair[2]);
    }
    if (section === "tool.setuptools" && pair[1] === "package-dir") {
      packageDir = readPackageDir(pair[2]);
    }
  }
  const roots = where ?? (packageDir !== undefined ? [packageDir] : undefined);
  return { name, roots };
}

export function readSetupCfg(text: string): PythonLayout {
  let section = "";
  let name: string | undefined;
  let packageDir: string | undefined;
  let where: string | undefined;
  let pendingPackageDir = false;
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }
    const header = /^\[([^\]]+)\]$/.exec(trimmed);
    if (header?.[1] !== undefined) {
      section = header[1].trim();
      pendingPackageDir = false;
      continue;
    }
    if (pendingPackageDir && trimmed.startsWith("=")) {
      packageDir = trimmed.replace(/^=\s*/, "").trim() || undefined;
      pendingPackageDir = false;
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (section === "metadata" && key === "name" && value.length > 0) {
      name = value;
    }
    if (section === "options.packages.find" && key === "where" && value.length > 0) {
      where = value;
    }
    if (section === "options" && key === "package_dir") {
      if (value.length === 0) {
        pendingPackageDir = true;
      } else {
        packageDir = value.startsWith("=") ? value.slice(1).trim() : value;
      }
    }
  }
  const roots =
    where !== undefined
      ? where.split(/[\s,]+/).filter((item) => item.length > 0)
      : packageDir !== undefined && packageDir.length > 0
        ? [packageDir]
        : undefined;
  return { name, roots: roots !== undefined && roots.length > 0 ? roots : undefined };
}
