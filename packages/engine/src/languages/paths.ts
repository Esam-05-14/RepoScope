import { createHash } from "node:crypto";

export function joinInside(base: string, relative: string): string | undefined {
  if (relative.includes("\\") || relative.startsWith("/") || /^[A-Za-z]:/.test(relative)) {
    return undefined;
  }
  const out = base === "" || base === "." ? [] : base.split("/");
  for (const part of relative.split("/")) {
    if (part.length === 0 || part === ".") {
      continue;
    }
    if (part === "..") {
      if (out.length === 0) {
        return undefined;
      }
      out.pop();
      continue;
    }
    if (!/^[A-Za-z0-9_.@+-]+$/.test(part)) {
      return undefined;
    }
    out.push(part);
  }
  return out.join("/");
}

export function digestOf(material: string): string {
  return `sha256:${createHash("sha256").update(material, "utf8").digest("hex")}`;
}

export function boundedContextId(label: string): string {
  const id = label.startsWith("ctx:") ? label : `ctx:${label}`;
  if (id.length <= 128) {
    return id;
  }
  return `ctx:${createHash("sha256").update(id, "utf8").digest("hex").slice(0, 40)}`;
}

export function safePackageName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 256) {
    return undefined;
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    return undefined;
  }
  return trimmed;
}

export function directoryIndex(files: Iterable<string>): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    const parts = file.split("/");
    let acc = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (part === undefined || part.length === 0) {
        continue;
      }
      acc = acc.length === 0 ? part : `${acc}/${part}`;
      dirs.add(acc);
    }
  }
  return dirs;
}

export function isUnder(file: string, directory: string): boolean {
  if (directory === "" || directory === ".") {
    return true;
  }
  return file === directory || file.startsWith(`${directory}/`);
}
