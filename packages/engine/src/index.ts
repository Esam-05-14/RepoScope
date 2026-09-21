import { type ScanStatus } from "@reposcope/contracts";
import { emptyAdjacency } from "@reposcope/graph";

export { scanRepository, type ScanOptions } from "./scan.js";
export { ConfinedFilesystemHost } from "./filesystem/confined-fs.js";
export { inventoryRepository, DEFAULT_LIMITS } from "./filesystem/inventory.js";
export { isInsideRoot } from "./filesystem/paths.js";

export function initialScanStatus(): ScanStatus {
  return "idle";
}

export function emptyGraphPlaceholder(): ReturnType<typeof emptyAdjacency> {
  return emptyAdjacency();
}
