import path from "node:path";
import {
  ENGINE_VERSION,
  PARSER_VERSION,
  SCHEMA_VERSION,
  semanticEdgeKey,
  syntaxClassOf,
  validateAnalysisSnapshot,
  type AnalysisSnapshot,
  type ConstructCounts,
  type EdgePolicy,
  type FileNode,
  type ImportObservation,
  type Resolution,
  type SemanticEdge,
  type SnapshotKind,
  type WorkspacePackage,
} from "@reposcope/contracts";
import {
  extractConstructs,
  isRelativeSpecifier,
  parseDiagnostics,
  parseSourceFile,
  resolveSpecifier,
} from "@reposcope/parser-ts";
import {
  createContextSelector,
  inferredContext,
  loadProjectContexts,
  type BoundContext,
} from "./contexts.js";
import { contentManifestDigestOf, graphDigestOf } from "./digest.js";
import { ConfinedFilesystemHost } from "./filesystem/confined-fs.js";
import type { AnalysisFilesystemHost } from "./filesystem/host.js";
import { DEFAULT_LIMITS, inventoryRepository } from "./filesystem/inventory.js";
import { isInsideRoot, toPosixRelative } from "./filesystem/paths.js";
import {
  isAssetSpecifier,
  isNodeBuiltinSpecifier,
  isOversizedSpecifier,
  isProtocolSpecifier,
} from "./assets.js";
import { repositoryIdentityForRoot } from "./persist.js";
import {
  resolveWorkspaceSpecifier,
  type PackageManifest,
} from "./workspace-resolve.js";

export interface ScanProgress {
  phase: "inventory" | "parse" | "graph";
  discoveredFiles: number;
  analyzedFiles: number;
  reusedFiles: number;
}

export interface ScanOptions {
  root: string;
  edgePolicy?: EdgePolicy;
  host?: AnalysisFilesystemHost;
  scopeKind?: SnapshotKind;
  selectedCommit?: string;
  scanId?: string;
  previousSnapshot?: AnalysisSnapshot;
  includeDynamicImport?: boolean;
  shouldCancel?: () => boolean;
  onProgress?: (progress: ScanProgress) => void;
}

export interface ScanResult {
  snapshot: AnalysisSnapshot | undefined;
  canceled: boolean;
}

export class ScanCanceledError extends Error {
  constructor() {
    super("scan canceled");
    this.name = "ScanCanceledError";
  }
}

export { repositoryIdentityForRoot };

const MAX_OBSERVATIONS_PER_FILE = 512;
const RESOLVE_CACHE_CAP = 20_000;
const PROGRESS_EVERY = 32;

function emptyCounts(): ConstructCounts {
  return {
    internal: 0,
    external: 0,
    unresolved: 0,
    unsupported: 0,
    typeOnly: 0,
    mixed: 0,
  };
}

function cheapResolution(specifier: string, contextId: string): Resolution | undefined {
  if (isOversizedSpecifier(specifier)) {
    return { status: "unsupported", contextId, reasonCode: "LIMIT_HIT" };
  }
  if (isNodeBuiltinSpecifier(specifier)) {
    return {
      status: "external",
      externalName: specifier.slice(0, 256),
      contextId,
      reasonCode: "NODE_BUILTIN",
    };
  }
  if (isProtocolSpecifier(specifier)) {
    return { status: "unsupported", contextId, reasonCode: "PROTOCOL_UNSUPPORTED" };
  }
  if (isAssetSpecifier(specifier)) {
    return { status: "unsupported", contextId, reasonCode: "ASSET_UNSUPPORTED" };
  }
  return undefined;
}

function classifyResolution(input: {
  supported: boolean;
  specifier: string;
  containingFile: string;
  resolved: string | undefined;
  host: AnalysisFilesystemHost;
  inventoryIds: ReadonlySet<string>;
  contextId: string;
  workspacePackages: readonly WorkspacePackage[];
  workspaceCache: Map<string, PackageManifest | null>;
}): Resolution {
  const cheap = cheapResolution(input.specifier, input.contextId);
  if (cheap !== undefined) {
    return cheap;
  }
  if (!input.supported) {
    return {
      status: "unsupported",
      contextId: input.contextId,
      reasonCode: "UNSUPPORTED_SYNTAX",
    };
  }
  if (input.resolved !== undefined && isInsideRoot(input.host.root, input.resolved)) {
    const relative = toPosixRelative(input.host.root, input.resolved);
    if (input.inventoryIds.has(relative)) {
      return {
        status: "internal",
        targetId: relative,
        contextId: input.contextId,
        reasonCode: "RESOLVED_INTERNAL",
      };
    }
    if (relative.endsWith(".d.ts")) {
      return {
        status: "declaration-only",
        contextId: input.contextId,
        reasonCode: "DECLARATION_ONLY",
      };
    }
  }
  if (!isRelativeSpecifier(input.specifier)) {
    const workspace = resolveWorkspaceSpecifier({
      specifier: input.specifier,
      packages: input.workspacePackages,
      inventoryIds: input.inventoryIds,
      host: input.host,
      contextId: input.contextId,
      cache: input.workspaceCache,
    });
    if (workspace !== undefined) {
      return workspace;
    }
  }
  if (input.resolved !== undefined) {
    if (!isInsideRoot(input.host.root, input.resolved)) {
      return {
        status: isRelativeSpecifier(input.specifier) ? "unresolved" : "external",
        contextId: input.contextId,
        reasonCode: isRelativeSpecifier(input.specifier)
          ? "OUTSIDE_ROOT"
          : "EXTERNAL_PACKAGE",
        externalName: isRelativeSpecifier(input.specifier) ? undefined : input.specifier,
      };
    }
    return {
      status: "unresolved",
      contextId: input.contextId,
      reasonCode: "UNRESOLVED_MODULE",
    };
  }
  if (isRelativeSpecifier(input.specifier)) {
    const guess = path.resolve(path.dirname(input.containingFile), input.specifier);
    if (input.host.confine(guess) === null) {
      return {
        status: "unresolved",
        contextId: input.contextId,
        reasonCode: "OUTSIDE_ROOT",
      };
    }
    return {
      status: "unresolved",
      contextId: input.contextId,
      reasonCode: "UNRESOLVED_MODULE",
    };
  }
  return {
    status: "external",
    externalName: input.specifier,
    contextId: input.contextId,
    reasonCode: "EXTERNAL_PACKAGE",
  };
}

function observationSupported(
  observation: ImportObservation,
  includeDynamicImport: boolean,
): boolean {
  if (isAssetSpecifier(observation.specifier)) {
    return false;
  }
  if (
    includeDynamicImport &&
    observation.syntaxKind === "dynamic-import" &&
    observation.specifier !== "unknown"
  ) {
    return true;
  }
  return (
    observation.resolution.reasonCode !== "UNSUPPORTED_SYNTAX" &&
    observation.resolution.reasonCode !== "ASSET_UNSUPPORTED"
  );
}

function mergeImportedNames(
  existing: readonly string[] | undefined,
  next: readonly string[] | undefined,
): string[] | undefined {
  if (existing === undefined && next === undefined) {
    return undefined;
  }
  const names = [...new Set([...(existing ?? []), ...(next ?? [])])].sort();
  return names.slice(0, 64);
}

function reusePriorResolution(
  prior: ImportObservation,
  inventoryIds: ReadonlySet<string>,
  contextId: string,
): Resolution | undefined {
  const cheap = cheapResolution(prior.specifier, contextId);
  if (cheap !== undefined) {
    return cheap;
  }
  if (
    prior.resolution.status === "internal" &&
    prior.resolution.targetId !== undefined &&
    inventoryIds.has(prior.resolution.targetId)
  ) {
    return {
      ...prior.resolution,
      contextId,
    };
  }
  return undefined;
}

function resolveObservation(input: {
  specifier: string;
  supported: boolean;
  containingFile: string;
  options: BoundContext["options"];
  host: AnalysisFilesystemHost;
  inventoryIds: ReadonlySet<string>;
  contextId: string;
  cache: Map<string, Resolution>;
  stats: { hits: number };
  workspacePackages: readonly WorkspacePackage[];
  workspaceCache: Map<string, PackageManifest | null>;
}): Resolution {
  const cheap = cheapResolution(input.specifier, input.contextId);
  if (cheap !== undefined) {
    return cheap;
  }
  const cacheKey = `${input.contextId}\0${path.dirname(input.containingFile)}\0${input.specifier}\0${input.supported ? "1" : "0"}`;
  const cached = input.cache.get(cacheKey);
  if (cached !== undefined) {
    input.stats.hits += 1;
    return cached;
  }
  const resolved = input.supported
    ? resolveSpecifier({
        specifier: input.specifier,
        containingFile: input.containingFile,
        options: input.options,
        host: input.host,
      })
    : undefined;
  const resolution = classifyResolution({
    supported: input.supported,
    specifier: input.specifier,
    containingFile: input.containingFile,
    resolved,
    host: input.host,
    inventoryIds: input.inventoryIds,
    contextId: input.contextId,
    workspacePackages: input.workspacePackages,
    workspaceCache: input.workspaceCache,
  });
  if (input.cache.size < RESOLVE_CACHE_CAP) {
    input.cache.set(cacheKey, resolution);
  }
  return resolution;
}

function countObservations(observations: readonly ImportObservation[]): ConstructCounts {
  const counts = emptyCounts();
  for (const observation of observations) {
    if (observation.edgeClass === "type") {
      counts.typeOnly += 1;
    }
    if (observation.edgeClass === "mixed") {
      counts.mixed += 1;
    }
    if (observation.resolution.status === "internal") {
      counts.internal += 1;
    } else if (observation.resolution.status === "external") {
      counts.external += 1;
    } else if (observation.resolution.status === "unsupported") {
      counts.unsupported += 1;
    } else if (observation.resolution.status === "unresolved") {
      counts.unresolved += 1;
    }
  }
  return counts;
}

function previousContextDigest(
  previous: AnalysisSnapshot | undefined,
  contextId: string,
): string | undefined {
  return previous?.projectContexts?.find((context) => context.id === contextId)?.digest;
}

export function scanRepositoryDetailed(options: ScanOptions): ScanResult {
  const started = Date.now();
  const root = path.resolve(options.root);
  const host = options.host ?? new ConfinedFilesystemHost(root);
  const canceled = (): boolean => options.shouldCancel?.() === true;
  if (canceled()) {
    return { snapshot: undefined, canceled: true };
  }
  options.onProgress?.({
    phase: "inventory",
    discoveredFiles: 0,
    analyzedFiles: 0,
    reusedFiles: 0,
  });
  const inventory = inventoryRepository(host);
  if (canceled()) {
    return { snapshot: undefined, canceled: true };
  }
  const inferred = inferredContext();
  const loaded = loadProjectContexts(host, inventory.configFiles);
  const contexts = [inferred, ...loaded];
  const selectContext = createContextSelector(root, loaded, inferred);
  const inventoryIds = new Set(inventory.files.map((file) => file.relativePath));
  const edgePolicy = options.edgePolicy ?? "value-and-mixed";
  const includeDynamicImport = options.includeDynamicImport === true;
  const resolveCache = new Map<string, Resolution>();
  const resolveStats = { hits: 0 };
  const workspaceCache = new Map<string, PackageManifest | null>();
  let reusedResolutions = 0;
  const scanTruncations: string[] = [];
  const previous = options.previousSnapshot;
  const previousNodes = new Map(previous?.nodes.map((node) => [node.id, node]) ?? []);
  const previousObservations = new Map<string, ImportObservation[]>();
  for (const observation of previous?.observations ?? []) {
    const list = previousObservations.get(observation.importerId) ?? [];
    list.push(observation);
    previousObservations.set(observation.importerId, list);
  }

  const nodes: FileNode[] = [];
  const observations: ImportObservation[] = [];
  let parseFailures = 0;
  let analyzedFiles = 0;
  let reusedFiles = 0;
  let parsedSinceProgress = 0;

  const emitParseProgress = (force = false): void => {
    parsedSinceProgress += 1;
    if (!force && parsedSinceProgress < PROGRESS_EVERY) {
      return;
    }
    parsedSinceProgress = 0;
    options.onProgress?.({
      phase: "parse",
      discoveredFiles: inventory.discoveredFiles,
      analyzedFiles,
      reusedFiles,
    });
  };

  options.onProgress?.({
    phase: "parse",
    discoveredFiles: inventory.discoveredFiles,
    analyzedFiles: 0,
    reusedFiles: 0,
  });

  for (const file of inventory.files) {
    if (canceled()) {
      return { snapshot: undefined, canceled: true };
    }
    const context = selectContext(file.absolutePath);
    const previousNode = previousNodes.get(file.relativePath);
    const previousDigest = previousContextDigest(previous, context.record.id);
    const canReuse =
      previousNode !== undefined &&
      previousNode.contentHash === file.contentHash &&
      previousNode.projectContextId === context.record.id &&
      (context.record.digest === undefined ||
        previousDigest === undefined ||
        previousDigest === context.record.digest);

    if (canReuse) {
      nodes.push({
        ...previousNode,
        projectContextId: context.record.id,
      });
      if (previousNode.parseStatus !== "skipped") {
        analyzedFiles += 1;
      }
      reusedFiles += 1;
      const reused = previousObservations.get(file.relativePath) ?? [];
      for (const prior of reused) {
        const reusedResolution = reusePriorResolution(prior, inventoryIds, context.record.id);
        const resolution =
          reusedResolution ??
          resolveObservation({
            specifier: prior.specifier,
            supported: observationSupported(prior, includeDynamicImport),
            containingFile: file.absolutePath,
            options: context.options,
            host,
            inventoryIds,
            contextId: context.record.id,
            cache: resolveCache,
            stats: resolveStats,
            workspacePackages: inventory.workspacePackages,
            workspaceCache,
          });
        if (reusedResolution !== undefined) {
          reusedResolutions += 1;
        }
        observations.push({
          ...prior,
          resolution,
        });
      }
      emitParseProgress();
      continue;
    }

    if (file.text === undefined) {
      nodes.push({
        id: file.relativePath,
        relativePath: file.relativePath,
        contentHash: file.contentHash,
        language: file.language,
        projectContextId: context.record.id,
        parseStatus: "skipped",
      });
      continue;
    }
    const sourceFile = parseSourceFile(file.absolutePath, file.text, file.language);
    const diagnostics = parseDiagnostics(sourceFile);
    const parseStatus = diagnostics.length > 0 ? "partial" : "ok";
    if (parseStatus === "partial") {
      parseFailures += 1;
    }
    analyzedFiles += 1;
    nodes.push({
      id: file.relativePath,
      relativePath: file.relativePath,
      contentHash: file.contentHash,
      language: file.language,
      projectContextId: context.record.id,
      parseStatus,
    });

    const constructs = extractConstructs(sourceFile);
    if (constructs.length > MAX_OBSERVATIONS_PER_FILE) {
      scanTruncations.push(`max-observations:${file.relativePath}`);
    }
    for (const construct of constructs.slice(0, MAX_OBSERVATIONS_PER_FILE)) {
      const resolution = resolveObservation({
        specifier: construct.specifier,
        supported:
          construct.supported ||
          (includeDynamicImport &&
            construct.syntaxKind === "dynamic-import" &&
            construct.specifier !== "unknown"),
        containingFile: file.absolutePath,
        options: context.options,
        host,
        inventoryIds,
        contextId: context.record.id,
        cache: resolveCache,
        stats: resolveStats,
        workspacePackages: inventory.workspacePackages,
        workspaceCache,
      });
      observations.push({
        id: `obs:${file.relativePath}:${construct.range.startOffset}`,
        importerId: file.relativePath,
        specifier: construct.specifier,
        syntaxKind: construct.syntaxKind,
        edgeClass: construct.edgeClass,
        range: construct.range,
        resolution,
        importedNames: construct.importedNames,
        sideEffect: construct.sideEffect === true ? true : undefined,
      });
    }
    emitParseProgress();
  }

  const grouped = new Map<string, SemanticEdge>();
  for (const observation of observations) {
    const targetKey =
      observation.resolution.targetId !== undefined
        ? `internal:${observation.resolution.targetId}`
        : observation.resolution.status === "external"
          ? `external:${observation.resolution.externalName ?? observation.specifier}`
          : `unresolved:${observation.specifier}`;
    const syntaxClass = syntaxClassOf(observation.syntaxKind);
    const key = semanticEdgeKey({
      importerId: observation.importerId,
      targetKey,
      syntaxClass,
      edgeClass: observation.edgeClass,
    });
    const existing = grouped.get(key);
    if (existing !== undefined) {
      existing.observationIds.push(observation.id);
      existing.importedNames = mergeImportedNames(existing.importedNames, observation.importedNames);
      continue;
    }
    grouped.set(key, {
      key,
      importerId: observation.importerId,
      targetId: observation.resolution.targetId,
      unresolvedSpecifier:
        observation.resolution.targetId === undefined ? observation.specifier : undefined,
      edgeClass: observation.edgeClass,
      syntaxClass,
      observationIds: [observation.id],
      importedNames: observation.importedNames,
    });
  }

  const semanticEdges = [...grouped.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  observations.sort((a, b) => (a.id < b.id ? -1 : 1));

  if (canceled()) {
    return { snapshot: undefined, canceled: true };
  }

  options.onProgress?.({
    phase: "graph",
    discoveredFiles: inventory.discoveredFiles,
    analyzedFiles,
    reusedFiles,
  });

  const snapshot: AnalysisSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    parserVersion: PARSER_VERSION,
    scanId: options.scanId,
    scope: {
      kind: options.scopeKind ?? "working-tree",
      repositoryIdentity: repositoryIdentityForRoot(root),
      selectedCommit: options.selectedCommit,
      edgePolicy,
      limits: { ...DEFAULT_LIMITS },
      truncated: inventory.truncations.length > 0 || scanTruncations.length > 0,
    },
    projectContexts: contexts.map((context) => context.record),
    nodes,
    observations,
    semanticEdges,
    coverage: {
      discoveredFiles: inventory.discoveredFiles,
      analyzedFiles,
      skippedFiles: inventory.skippedFiles,
      parseFailures,
      constructCounts: countObservations(observations),
      truncations: [...new Set([...inventory.truncations, ...scanTruncations])].slice(0, 32),
      reusedFiles,
      declaredPackages: inventory.declaredPackages,
      skippedDirectories: inventory.skippedDirectories,
      workspacePackages: inventory.workspacePackages,
      elapsedMs: Math.max(0, Date.now() - started),
      resolverCacheHits: resolveStats.hits,
      reusedResolutions,
    },
    graphDigest: graphDigestOf(nodes, semanticEdges, edgePolicy),
    contentManifestDigest: contentManifestDigestOf(nodes),
  };
  validateAnalysisSnapshot(snapshot);
  return { snapshot, canceled: false };
}

export function scanRepository(options: ScanOptions): AnalysisSnapshot {
  const result = scanRepositoryDetailed(options);
  if (result.canceled || result.snapshot === undefined) {
    throw new ScanCanceledError();
  }
  return result.snapshot;
}
