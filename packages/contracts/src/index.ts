export const SCHEMA_VERSION = "1.0.0";
export const ENGINE_VERSION = "0.1.0-r1";
export const PARSER_VERSION = "typescript@6.0.3";

export const SCAN_STATUSES = [
  "idle",
  "scanning",
  "canceled",
  "failed",
  "partial",
  "completed",
] as const;

export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const ROOT_KINDS = ["none", "cli", "demo"] as const;
export type RootKind = (typeof ROOT_KINDS)[number];

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

export type EdgeClass = "value" | "type" | "mixed";
export type EdgePolicy = "value-and-mixed" | "include-type-only";

export function isScanStatus(value: string): value is ScanStatus {
  return (SCAN_STATUSES as readonly string[]).includes(value);
}

export function isTerminalScanStatus(status: ScanStatus): boolean {
  return (
    status === "canceled" ||
    status === "failed" ||
    status === "partial" ||
    status === "completed"
  );
}
