import type { EdgeClass, EdgePolicy } from "./status.js";

export type SnapshotKind = "working-tree" | "imported-snapshot" | "git-commit";

export type TsLanguageId =
  | "ts"
  | "tsx"
  | "js"
  | "jsx"
  | "mts"
  | "cts"
  | "mjs"
  | "cjs";

export type LanguageId = TsLanguageId | "py" | "java" | "kt";

const TS_LANGUAGE_IDS = new Set<string>(["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"]);

export function isTsLanguageId(language: LanguageId): language is TsLanguageId {
  return TS_LANGUAGE_IDS.has(language);
}

export type ContextLanguage = "typescript" | "python" | "java";

export type ParseStatus = "ok" | "partial" | "failed" | "skipped";

export type SyntaxKind =
  | "static-import"
  | "export-from"
  | "type-only-import"
  | "type-only-export-from"
  | "mixed-import"
  | "mixed-export-from"
  | "dynamic-import"
  | "require"
  | "import-equals"
  | "triple-slash-path"
  | "other-unsupported";

export type ResolutionStatus =
  | "internal"
  | "external"
  | "excluded"
  | "declaration-only"
  | "unresolved"
  | "unsupported";

export type ReasonCode =
  | "RESOLVED_INTERNAL"
  | "EXTERNAL_PACKAGE"
  | "UNRESOLVED_MODULE"
  | "UNSUPPORTED_SYNTAX"
  | "OUTSIDE_ROOT"
  | "EXCLUDED"
  | "DECLARATION_ONLY"
  | "CONFIG_OUTSIDE_ROOT"
  | "ENCODING_UNSUPPORTED"
  | "PARSE_FAILED"
  | "LIMIT_HIT"
  | "SYMLINK_SKIPPED"
  | "ASSET_UNSUPPORTED"
  | "PROTOCOL_UNSUPPORTED"
  | "NODE_BUILTIN"
  | "WORKSPACE_PACKAGE"
  | "WILDCARD_IMPORT";

export type SyntaxClass = "static-import" | "export-from" | "mixed";

export interface SourceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Resolution {
  status: ResolutionStatus;
  targetId?: string;
  externalName?: string;
  contextId?: string;
  reasonCode: ReasonCode;
}

export interface FileNode {
  id: string;
  relativePath: string;
  contentHash: string;
  language: LanguageId;
  projectContextId: string;
  parseStatus: ParseStatus;
}

export interface ImportObservation {
  id: string;
  importerId: string;
  specifier: string;
  syntaxKind: SyntaxKind;
  edgeClass: EdgeClass;
  range: SourceRange;
  resolution: Resolution;
  importedNames?: string[];
  sideEffect?: boolean;
}

export interface SemanticEdge {
  key: string;
  importerId: string;
  targetId?: string;
  unresolvedSpecifier?: string;
  edgeClass: EdgeClass;
  syntaxClass: SyntaxClass;
  observationIds: string[];
  importedNames?: string[];
}

export interface ProjectContext {
  id: string;
  kind: "tsconfig" | "jsconfig" | "inferred";
  configPath: string | null;
  digest?: string;
  pathMappings?: string[];
  language?: ContextLanguage;
}

export interface ConstructCounts {
  internal: number;
  external: number;
  unresolved: number;
  unsupported: number;
  typeOnly: number;
  mixed: number;
}

export interface Coverage {
  discoveredFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  parseFailures: number;
  constructCounts: ConstructCounts;
  truncations: string[];
  reusedFiles?: number;
  declaredPackages?: string[];
  skippedDirectories?: number;
  workspacePackages?: WorkspacePackage[];
  elapsedMs?: number;
  resolverCacheHits?: number;
  reusedResolutions?: number;
}

export interface WorkspacePackage {
  name: string;
  directory: string;
}

export interface ScanLimits {
  maxSourceFiles: number;
  maxBytesPerFile: number;
  maxAnalyzedBytes: number;
}

export interface ScanScope {
  kind: SnapshotKind;
  repositoryIdentity: string;
  selectedCommit?: string;
  edgePolicy: EdgePolicy;
  exclusionDigest?: string;
  limits: ScanLimits;
  truncated?: boolean;
}

export interface AnalysisSnapshot {
  schemaVersion: string;
  engineVersion: string;
  parserVersion: string;
  generatedAt?: string;
  scanId?: string;
  scope: ScanScope;
  projectContexts?: ProjectContext[];
  nodes: FileNode[];
  observations: ImportObservation[];
  semanticEdges: SemanticEdge[];
  coverage: Coverage;
  graphDigest: string;
  contentManifestDigest: string;
}
