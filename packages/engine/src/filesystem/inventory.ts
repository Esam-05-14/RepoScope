import { createHash } from "node:crypto";
import path from "node:path";
import type { LanguageId, ParseStatus, WorkspacePackage } from "@reposcope/contracts";
import { languageFromPath, SOURCE_EXTENSIONS } from "@reposcope/parser-ts";
import type { AnalysisFilesystemHost } from "./host.js";
import { toPosixRelative } from "./paths.js";

export const DEFAULT_LIMITS = {
  maxSourceFiles: 5000,
  maxBytesPerFile: 1024 * 1024,
  maxAnalyzedBytes: 100 * 1024 * 1024,
} as const;

const SKIP_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
  ".turbo",
  ".output",
  ".cache",
  "vendor",
  ".svn",
  ".hg",
  ".vercel",
  ".nuxt",
  ".svelte-kit",
  "storybook-static",
  "tmp",
]);

const MAX_WALK_DEPTH = 32;
const MAX_DIR_ENTRIES = 4096;

const CREDENTIAL_NAMES = new Set([".env", "id_rsa", "credentials.json"]);

export interface InventoryFile {
  absolutePath: string;
  relativePath: string;
  contentHash: string;
  language: LanguageId;
  text?: string;
  parseStatus: ParseStatus;
  skipReason?: string;
}

export interface InventoryResult {
  files: InventoryFile[];
  configFiles: string[];
  discoveredFiles: number;
  skippedFiles: number;
  skippedDirectories: number;
  declaredPackages: string[];
  workspacePackages: WorkspacePackage[];
  truncations: string[];
  analyzedBytes: number;
}

const MAX_PACKAGE_JSON_BYTES = 256 * 1024;

const PACKAGE_NAME = /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/;

function inspectPackageJson(
  text: string,
  directory: string,
): { names: string[]; workspace?: WorkspacePackage } {
  try {
    const parsed = JSON.parse(text) as {
      name?: unknown;
      dependencies?: unknown;
      devDependencies?: unknown;
      peerDependencies?: unknown;
      optionalDependencies?: unknown;
    };
    const names = new Set<string>();
    for (const field of [
      parsed.dependencies,
      parsed.devDependencies,
      parsed.peerDependencies,
      parsed.optionalDependencies,
    ]) {
      if (field === undefined || field === null || typeof field !== "object") {
        continue;
      }
      for (const key of Object.keys(field)) {
        if (key.length > 0 && key.length <= 256) {
          names.add(key);
        }
      }
    }
    const workspace =
      typeof parsed.name === "string" && PACKAGE_NAME.test(parsed.name) && parsed.name.length <= 256
        ? { name: parsed.name, directory }
        : undefined;
    return { names: [...names], workspace };
  } catch {
    return { names: [] };
  }
}

function isCredential(name: string): boolean {
  if (CREDENTIAL_NAMES.has(name) || name.startsWith(".env")) {
    return true;
  }
  return name.endsWith(".pem");
}

function decodeText(bytes: Buffer): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

export function inventoryRepository(
  host: AnalysisFilesystemHost,
): InventoryResult {
  const files: InventoryFile[] = [];
  const configFiles: string[] = [];
  const truncations: string[] = [];
  const declared = new Set<string>();
  const workspace = new Map<string, WorkspacePackage>();
  let discoveredFiles = 0;
  let skippedFiles = 0;
  let skippedDirectories = 0;
  let analyzedBytes = 0;

  const visit = (directory: string, depth: number): void => {
    if (depth > MAX_WALK_DEPTH) {
      truncations.push("max-directory-depth");
      return;
    }
    const names = host.readDirectory(directory);
    if (names.length > MAX_DIR_ENTRIES) {
      truncations.push("max-directory-entries");
    }
    for (const name of names.slice(0, MAX_DIR_ENTRIES)) {
      const absolute = path.join(directory, name);
      if (host.confine(absolute) === null) {
        continue;
      }
      const stat = host.stat(absolute);
      if (stat === undefined) {
        continue;
      }
      if (stat.isSymbolicLink) {
        skippedFiles += 1;
        truncations.push(`symlink-skipped:${toPosixRelative(host.root, absolute)}`);
        continue;
      }
      if (stat.isDirectory) {
        if (SKIP_DIRECTORIES.has(name)) {
          skippedDirectories += 1;
          continue;
        }
        visit(absolute, depth + 1);
        continue;
      }
      if (!stat.isFile) {
        continue;
      }
      if (name === "tsconfig.json" || name === "jsconfig.json") {
        configFiles.push(absolute);
      }
      if (name === "package.json") {
        const manifest = host.readFileBytes(absolute);
        if (manifest !== undefined && manifest.byteLength <= MAX_PACKAGE_JSON_BYTES) {
          const text = decodeText(manifest);
          if (text !== undefined) {
            const directory = toPosixRelative(host.root, path.dirname(absolute));
            const inspected = inspectPackageJson(text, directory === "" ? "." : directory);
            for (const pkg of inspected.names) {
              declared.add(pkg);
            }
            if (inspected.workspace !== undefined) {
              workspace.set(inspected.workspace.directory, inspected.workspace);
            }
          }
        }
      }
      const language = languageFromPath(name);
      if (language === undefined || !SOURCE_EXTENSIONS.has(path.extname(name))) {
        continue;
      }
      if (isCredential(name)) {
        skippedFiles += 1;
        continue;
      }
      discoveredFiles += 1;
      if (files.length >= DEFAULT_LIMITS.maxSourceFiles) {
        truncations.push("max-source-files");
        continue;
      }
      const bytes = host.readFileBytes(absolute);
      if (bytes === undefined) {
        skippedFiles += 1;
        continue;
      }
      if (bytes.byteLength > DEFAULT_LIMITS.maxBytesPerFile) {
        skippedFiles += 1;
        truncations.push(`max-bytes-per-file:${toPosixRelative(host.root, absolute)}`);
        continue;
      }
      if (analyzedBytes + bytes.byteLength > DEFAULT_LIMITS.maxAnalyzedBytes) {
        skippedFiles += 1;
        truncations.push("max-analyzed-bytes");
        continue;
      }
      analyzedBytes += bytes.byteLength;
      const text = decodeText(bytes);
      files.push({
        absolutePath: absolute,
        relativePath: toPosixRelative(host.root, absolute),
        contentHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        language,
        text,
        parseStatus: text === undefined ? "skipped" : "ok",
        skipReason: text === undefined ? "ENCODING_UNSUPPORTED" : undefined,
      });
    }
  };

  visit(host.root, 0);
  configFiles.sort();
  files.sort((a, b) => (a.relativePath < b.relativePath ? -1 : 1));
  return {
    files,
    configFiles,
    discoveredFiles,
    skippedFiles,
    skippedDirectories,
    declaredPackages: [...declared].sort(),
    workspacePackages: [...workspace.values()].sort((left, right) => left.directory.localeCompare(right.directory)),
    truncations: [...new Set(truncations)].slice(0, 32),
    analyzedBytes,
  };
}
