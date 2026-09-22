import path from "node:path";
import type { Resolution, WorkspacePackage } from "@reposcope/contracts";
import { packageNameFromSpecifier } from "./assets.js";
import type { AnalysisFilesystemHost } from "./filesystem/host.js";
import { toPosixRelative } from "./filesystem/paths.js";

const MANIFEST_CAP = 256 * 1024;
const SOURCE_SUFFIXES = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export interface PackageManifest {
  name?: string;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  exports?: unknown;
}

export function matchWorkspacePackage(
  specifier: string,
  packages: readonly WorkspacePackage[],
): WorkspacePackage | undefined {
  if (packageNameFromSpecifier(specifier) === undefined) {
    return undefined;
  }
  return [...packages]
    .filter((item) => specifier === item.name || specifier.startsWith(`${item.name}/`))
    .sort((left, right) => right.name.length - left.name.length)[0];
}

export function parsePackageManifest(text: string): PackageManifest | undefined {
  try {
    const parsed = JSON.parse(text) as PackageManifest;
    return parsed !== null && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function decodeText(bytes: Buffer): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

export function readPackageManifest(
  host: AnalysisFilesystemHost,
  directory: string,
  cache: Map<string, PackageManifest | null>,
): PackageManifest | undefined {
  const cached = cache.get(directory);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const absolute =
    directory === "." ? path.join(host.root, "package.json") : path.join(host.root, ...directory.split("/"), "package.json");
  const confined = host.confine(absolute);
  if (confined === null) {
    cache.set(directory, null);
    return undefined;
  }
  const bytes = host.readFileBytes(confined);
  if (bytes === undefined || bytes.byteLength > MANIFEST_CAP) {
    cache.set(directory, null);
    return undefined;
  }
  const text = decodeText(bytes);
  const manifest = text === undefined ? undefined : parsePackageManifest(text);
  cache.set(directory, manifest ?? null);
  return manifest;
}

function flattenExportTarget(target: unknown, acc: string[]): void {
  if (typeof target === "string" && target.length > 0 && target.length <= 512) {
    acc.push(target);
    return;
  }
  if (Array.isArray(target)) {
    for (const item of target) {
      flattenExportTarget(item, acc);
    }
    return;
  }
  if (target === null || target === undefined || typeof target !== "object") {
    return;
  }
  const record = target as Record<string, unknown>;
  for (const key of ["types", "import", "default", "module", "require", "node", "browser"]) {
    flattenExportTarget(record[key], acc);
  }
}

function wildcardCapture(pattern: string, value: string): string | undefined {
  const star = pattern.indexOf("*");
  if (star < 0) {
    return undefined;
  }
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!value.startsWith(prefix) || !value.endsWith(suffix)) {
    return undefined;
  }
  return value.slice(prefix.length, value.length - suffix.length);
}

function applyWildcard(pattern: string, capture: string): string {
  return pattern.replaceAll("*", capture);
}

export function exportTargets(exportsField: unknown, subpath: string): string[] {
  if (typeof exportsField === "string") {
    return subpath === "." ? [exportsField] : [];
  }
  if (exportsField === null || exportsField === undefined || typeof exportsField !== "object") {
    return [];
  }
  const record = exportsField as Record<string, unknown>;
  const direct = record[subpath];
  if (direct !== undefined) {
    const acc: string[] = [];
    flattenExportTarget(direct, acc);
    return acc;
  }
  const acc: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (!key.includes("*")) {
      continue;
    }
    const capture = wildcardCapture(key, subpath);
    if (capture === undefined) {
      continue;
    }
    const mapped: string[] = [];
    flattenExportTarget(value, mapped);
    for (const item of mapped) {
      acc.push(applyWildcard(item, capture));
    }
  }
  return acc;
}

function expandSourceCandidates(relative: string): string[] {
  const out = new Set<string>([relative]);
  const swap = relative.replace(/\/dist\//, "/src/").replace(/\/lib\//, "/src/");
  out.add(swap);
  for (const id of [...out]) {
    if (id.endsWith(".js")) {
      out.add(`${id.slice(0, -3)}.ts`);
      out.add(`${id.slice(0, -3)}.tsx`);
      out.add(`${id.slice(0, -3)}.jsx`);
      out.add(`${id.slice(0, -3)}.mts`);
    } else if (id.endsWith(".mjs")) {
      out.add(`${id.slice(0, -4)}.mts`);
      out.add(`${id.slice(0, -4)}.ts`);
    } else if (id.endsWith(".cjs")) {
      out.add(`${id.slice(0, -4)}.cts`);
      out.add(`${id.slice(0, -4)}.ts`);
    } else if (!SOURCE_SUFFIXES.some((ext) => id.endsWith(ext))) {
      for (const ext of SOURCE_SUFFIXES) {
        out.add(`${id}${ext}`);
        out.add(`${id}/index${ext}`);
      }
    }
  }
  return [...out];
}

function joinPackagePath(directory: string, candidate: string): string | undefined {
  const cleaned = candidate.replace(/\\/g, "/").replace(/^\.\//, "");
  if (cleaned.startsWith("/") || cleaned.includes("\0") || cleaned.length === 0) {
    return undefined;
  }
  const parts = cleaned.split("/").filter((part) => part.length > 0);
  if (parts.some((part) => part === "..")) {
    return undefined;
  }
  return directory === "." ? parts.join("/") : `${directory}/${parts.join("/")}`;
}

export function mapWorkspaceCandidate(
  directory: string,
  candidate: string,
  inventoryIds: ReadonlySet<string>,
  host: AnalysisFilesystemHost,
): string | undefined {
  const joined = joinPackagePath(directory, candidate);
  if (joined === undefined) {
    return undefined;
  }
  const absolute = path.join(host.root, ...joined.split("/"));
  if (host.confine(absolute) === null) {
    return undefined;
  }
  const relative = toPosixRelative(host.root, absolute);
  for (const id of expandSourceCandidates(relative)) {
    if (inventoryIds.has(id)) {
      return id;
    }
  }
  return undefined;
}

function entryCandidates(manifest: PackageManifest | undefined, subpath: string): string[] {
  const fromExports = exportTargets(manifest?.exports, subpath);
  if (fromExports.length > 0) {
    return fromExports;
  }
  if (subpath !== ".") {
    const rest = subpath.startsWith("./") ? subpath.slice(2) : subpath;
    return [`src/${rest}`, rest];
  }
  const fields = [manifest?.types, manifest?.typings, manifest?.module, manifest?.main].filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
  return [...fields, "src/index.ts", "src/index.tsx", "src/index.js", "index.ts", "index.js"];
}

export function resolveWorkspaceSpecifier(input: {
  specifier: string;
  packages: readonly WorkspacePackage[];
  inventoryIds: ReadonlySet<string>;
  host: AnalysisFilesystemHost;
  contextId: string;
  cache: Map<string, PackageManifest | null>;
}): Resolution | undefined {
  const matched = matchWorkspacePackage(input.specifier, input.packages);
  if (matched === undefined) {
    return undefined;
  }
  const subpath = input.specifier === matched.name ? "." : `./${input.specifier.slice(matched.name.length + 1)}`;
  const manifest = readPackageManifest(input.host, matched.directory, input.cache);
  for (const candidate of entryCandidates(manifest, subpath)) {
    const targetId = mapWorkspaceCandidate(matched.directory, candidate, input.inventoryIds, input.host);
    if (targetId !== undefined) {
      return {
        status: "internal",
        targetId,
        contextId: input.contextId,
        reasonCode: "WORKSPACE_PACKAGE",
      };
    }
  }
  return undefined;
}
