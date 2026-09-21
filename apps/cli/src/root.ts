import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_MARKER = path.join("fixtures", "esm-baseline", "src", "main.ts");

export function findWorkspaceRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(dir, DEMO_MARKER))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("bundled fixtures/esm-baseline was not found");
    }
    dir = parent;
  }
}

export function demoRoot(startDir: string): {
  canonicalRoot: string;
  label: string;
} {
  const workspace = findWorkspaceRoot(startDir);
  const raw = path.join(workspace, "fixtures", "esm-baseline");
  return {
    canonicalRoot: canonicalizeDirectory(raw),
    label: "fixtures/esm-baseline",
  };
}

export function canonicalizeDirectory(input: string): string {
  const absolute = path.resolve(input);
  if (!existsSync(absolute)) {
    throw new Error("selected root does not exist");
  }
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    throw new Error("selected root must not be a symlink or junction");
  }
  if (!stat.isDirectory()) {
    throw new Error("selected root must be a directory");
  }
  const canonical = realpathSync.native(absolute);
  if (!statSync(canonical).isDirectory()) {
    throw new Error("selected root must be a directory");
  }
  return canonical;
}

const DEMO_FIXTURE_IDS = [
  "esm-baseline",
  "esm-revised",
  "unresolved-import",
  "type-only-cycle",
  "duplicate-imports",
  "self-import",
  "malformed-source",
  "alias-paths",
  "unsupported-constructs",
] as const;

export function bundledFixtures(startDir: string): Record<string, string> {
  const workspace = findWorkspaceRoot(startDir);
  const catalog: Record<string, string> = {};
  for (const id of DEMO_FIXTURE_IDS) {
    catalog[id] = canonicalizeDirectory(path.join(workspace, "fixtures", id));
  }
  return catalog;
}

export function defaultStartDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}
