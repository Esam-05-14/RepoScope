import { describe, expect, it } from "vitest";
import {
  isScanStatus,
  isTerminalScanStatus,
  SCAN_STATUSES,
} from "@reposcope/contracts";
import { initialScanStatus } from "@reposcope/engine";

describe("scan status contract", () => {
  it("includes idle, scanning, canceled, failed, partial, completed", () => {
    expect([...SCAN_STATUSES]).toEqual([
      "idle",
      "scanning",
      "canceled",
      "failed",
      "partial",
      "completed",
    ]);
    expect(isScanStatus("idle")).toBe(true);
    expect(isScanStatus("running")).toBe(false);
    expect(initialScanStatus()).toBe("idle");
    expect(isTerminalScanStatus("canceled")).toBe(true);
    expect(isTerminalScanStatus("completed")).toBe(true);
    expect(isTerminalScanStatus("idle")).toBe(false);
  });
});
