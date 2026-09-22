import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloneGitHubRepository,
  looksLikeGitHubInput,
  parseGitHubRepoInput,
} from "@reposcope/engine";

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

export async function resolveCliTarget(
  input: string | undefined,
  commit?: string,
): Promise<{ canonicalRoot: string; label: string; kind: "cli" | "github" }> {
  if (input === undefined || input === "") {
    const canonicalRoot = canonicalizeDirectory(process.cwd());
    return { canonicalRoot, label: path.basename(canonicalRoot), kind: "cli" };
  }
  if (existsSync(input)) {
    const canonicalRoot = canonicalizeDirectory(input);
    return { canonicalRoot, label: path.basename(canonicalRoot), kind: "cli" };
  }
  if (!looksLikeGitHubInput(input)) {
    throw new Error("selected root does not exist");
  }
  const spec = parseGitHubRepoInput(input);
  const cloned = await cloneGitHubRepository({ spec, ref: commit ?? spec.ref });
  return { canonicalRoot: cloned.root, label: cloned.label, kind: "github" };
}
