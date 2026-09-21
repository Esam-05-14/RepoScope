import { createHash } from "node:crypto";
import path from "node:path";
import type { LanguageId, ParseStatus } from "@reposcope/contracts";
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
]);

const CREDENTIAL_NAMES = new Set([".env", "id_rsa", "credentials.json"]);

export interface InventoryFile {
  absolutePath: string;
  relativePath: string;
  contentHash: string;
  language: LanguageId;
  bytes: Buffer;
  text?: string;
  parseStatus: ParseStatus;
  skipReason?: string;
}

export interface InventoryResult {
  files: InventoryFile[];
  configFiles: string[];
  discoveredFiles: number;
  skippedFiles: number;
  truncations: string[];
  analyzedBytes: number;
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
  let discoveredFiles = 0;
  let skippedFiles = 0;
  let analyzedBytes = 0;

  const visit = (directory: string): void => {
    const names = host.readDirectory(directory);
    for (const name of names) {
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
          continue;
        }
        visit(absolute);
        continue;
      }
      if (!stat.isFile) {
        continue;
      }
      if (name === "tsconfig.json" || name === "jsconfig.json") {
        configFiles.push(absolute);
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
        bytes,
        text,
        parseStatus: text === undefined ? "skipped" : "ok",
        skipReason: text === undefined ? "ENCODING_UNSUPPORTED" : undefined,
      });
    }
  };

  visit(host.root);
  configFiles.sort();
  files.sort((a, b) => (a.relativePath < b.relativePath ? -1 : 1));
  return {
    files,
    configFiles,
    discoveredFiles,
    skippedFiles,
    truncations: [...new Set(truncations)],
    analyzedBytes,
  };
}
