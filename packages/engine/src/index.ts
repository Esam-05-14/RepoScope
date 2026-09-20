import { type ScanStatus } from "@reposcope/contracts";
import { emptyAdjacency } from "@reposcope/graph";

export function initialScanStatus(): ScanStatus {
  return "idle";
}

export function emptyGraphPlaceholder(): ReturnType<typeof emptyAdjacency> {
  return emptyAdjacency();
}
