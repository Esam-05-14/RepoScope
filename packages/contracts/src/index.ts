export const SCHEMA_VERSION = "1.0.0";
export const ENGINE_VERSION = "0.9.1-perf";
export const PARSER_VERSION = "typescript@6.0.3";

export const API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN_ORIGIN",
  "INVALID_HOST",
  "VALIDATION_FAILED",
  "SCAN_NOT_FOUND",
  "SCAN_CANCELED",
  "SCAN_FAILED",
  "SCAN_PARTIAL",
  "SNAPSHOT_INCOMPATIBLE",
  "EVIDENCE_STALE",
  "EVIDENCE_UNAVAILABLE",
  "LIMIT_HIT",
  "UNSUPPORTED_REPOSITORY",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  diagnosticId: string;
}

export interface HealthResponse {
  ok: true;
  bind: "127.0.0.1";
  root: {
    kind: RootKind;
    label: string;
  };
  scan: {
    status: ScanStatus;
  };
}

export {
  SCAN_STATUSES,
  ROOT_KINDS,
  isScanStatus,
  isTerminalScanStatus,
  type ScanStatus,
  type RootKind,
  type EdgeClass,
  type EdgePolicy,
} from "./status.js";
export {
  semanticEdgeKey,
  targetKeyForEdge,
  syntaxClassOf,
} from "./identity.js";
export { validateAnalysisSnapshot, SnapshotValidationError } from "./validate.js";
export {
  BRIEF_CLAIMS,
  buildInvestigationBrief,
  formatInvestigationBrief,
  type BriefComponent,
  type BriefComponentEdge,
  type BriefDensity,
  type BriefFormatOptions,
  type BriefOmission,
  type ExternalPackageUse,
  type FileDegree,
  type InvestigationBrief,
} from "./brief.js";
export type {
  CompatibilityStatus,
  EdgeChange,
  EvidenceResponse,
  NodeChange,
  ScanProgressResponse,
  SnapshotComparison,
} from "./comparison.js";
export type {
  AnalysisSnapshot,
  ConstructCounts,
  Coverage,
  FileNode,
  ImportObservation,
  LanguageId,
  ParseStatus,
  ProjectContext,
  ReasonCode,
  Resolution,
  ResolutionStatus,
  ScanLimits,
  ScanScope,
  SemanticEdge,
  SnapshotKind,
  SourceRange,
  SyntaxClass,
  SyntaxKind,
  WorkspacePackage,
} from "./snapshot.js";

import type { RootKind, ScanStatus } from "./status.js";
