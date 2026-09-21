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
