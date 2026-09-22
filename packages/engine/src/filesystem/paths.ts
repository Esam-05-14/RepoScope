import path from "node:path";

export function isUncPath(value: string): boolean {
  return value.startsWith("\\\\") || value.startsWith("//");
}

export function toPosixRelative(root: string, absolute: string): string {
  const relative = path.relative(root, absolute);
  return relative.split(path.sep).join("/");
}

export function resolvedRootOf(root: string): string {
  return path.resolve(root);
}

export function isInsideRoot(root: string, candidate: string): boolean {
  return isInsideResolvedRoot(path.resolve(root), candidate);
}

export function isInsideResolvedRoot(resolvedRoot: string, candidate: string): boolean {
  if (isUncPath(candidate) || candidate.includes("\0")) {
    return false;
  }
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative === "") {
    return true;
  }
  if (path.isAbsolute(relative)) {
    return false;
  }
  const first = relative.split(path.sep)[0];
  return first !== "..";
}
