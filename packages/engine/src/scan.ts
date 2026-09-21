import { createHash } from "node:crypto";
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
} from "@reposcope/contracts";
import {
  extractConstructs,
  isRelativeSpecifier,
  parseDiagnostics,
  parseSourceFile,
  resolveSpecifier,
} from "@reposcope/parser-ts";
import { inferredContext, loadProjectContexts, selectContext } from "./contexts.js";
import { contentManifestDigestOf, graphDigestOf } from "./digest.js";
import { ConfinedFilesystemHost } from "./filesystem/confined-fs.js";
import { DEFAULT_LIMITS, inventoryRepository } from "./filesystem/inventory.js";
import { isInsideRoot, toPosixRelative } from "./filesystem/paths.js";

export interface ScanOptions {
  root: string;
  edgePolicy?: EdgePolicy;
}

function repositoryIdentity(root: string): string {
  const digest = createHash("sha256").update(path.resolve(root), "utf8").digest("hex");
  return `repo:${digest.slice(0, 16)}`;
}

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

function classifyResolution(input: {
  supported: boolean;
  specifier: string;
  containingFile: string;
  resolved: string | undefined;
  host: ConfinedFilesystemHost;
  inventoryIds: ReadonlySet<string>;
  contextId: string;
}): Resolution {
  if (!input.supported) {
    return {
      status: "unsupported",
      contextId: input.contextId,
      reasonCode: "UNSUPPORTED_SYNTAX",
    };
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

export function scanRepository(options: ScanOptions): AnalysisSnapshot {
  const root = path.resolve(options.root);
  const host = new ConfinedFilesystemHost(root);
  const inventory = inventoryRepository(host);
  const inferred = inferredContext();
  const loaded = loadProjectContexts(host, inventory.configFiles);
  const contexts = [inferred, ...loaded];
  const inventoryIds = new Set(inventory.files.map((file) => file.relativePath));
  const edgePolicy = options.edgePolicy ?? "value-and-mixed";

  const nodes: FileNode[] = [];
  const observations: ImportObservation[] = [];
  const counts = emptyCounts();
  let parseFailures = 0;
  let analyzedFiles = 0;

  for (const file of inventory.files) {
    const context = selectContext(file.absolutePath, root, loaded, inferred);
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
    for (const construct of constructs) {
      const resolved = construct.supported
        ? resolveSpecifier({
            specifier: construct.specifier,
            containingFile: file.absolutePath,
            options: context.options,
            host,
          })
        : undefined;
      const resolution = classifyResolution({
        supported: construct.supported,
        specifier: construct.specifier,
        containingFile: file.absolutePath,
        resolved,
        host,
        inventoryIds,
        contextId: context.record.id,
      });
      const observation: ImportObservation = {
        id: `obs:${file.relativePath}:${construct.range.startOffset}`,
        importerId: file.relativePath,
        specifier: construct.specifier,
        syntaxKind: construct.syntaxKind,
        edgeClass: construct.edgeClass,
        range: construct.range,
        resolution,
      };
      observations.push(observation);
      if (construct.edgeClass === "type") {
        counts.typeOnly += 1;
      }
      if (construct.edgeClass === "mixed") {
        counts.mixed += 1;
      }
      if (resolution.status === "internal") {
        counts.internal += 1;
      } else if (resolution.status === "external") {
        counts.external += 1;
      } else if (resolution.status === "unsupported") {
        counts.unsupported += 1;
      } else if (resolution.status === "unresolved") {
        counts.unresolved += 1;
      }
    }
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
    });
  }

  const semanticEdges = [...grouped.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  observations.sort((a, b) => (a.id < b.id ? -1 : 1));

  const snapshot: AnalysisSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    parserVersion: PARSER_VERSION,
    scope: {
      kind: "working-tree",
      repositoryIdentity: repositoryIdentity(root),
      edgePolicy,
      limits: { ...DEFAULT_LIMITS },
      truncated: inventory.truncations.length > 0,
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
      constructCounts: counts,
      truncations: inventory.truncations,
    },
    graphDigest: graphDigestOf(nodes, semanticEdges, edgePolicy),
    contentManifestDigest: contentManifestDigestOf(nodes),
  };
  validateAnalysisSnapshot(snapshot);
  return snapshot;
}
