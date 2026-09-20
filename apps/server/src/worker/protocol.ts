import type { ScanStatus } from "@reposcope/contracts";

export type WorkerInbound =
  | { type: "run-busy"; ticks?: number }
  | { type: "cancel" };

export type WorkerOutbound = { type: "status"; status: ScanStatus };

export interface CancellableJob {
  status(): ScanStatus;
  cancel(): void;
  run(ticks?: number): Promise<ScanStatus>;
}

export function createCancellableJob(): CancellableJob {
  let status: ScanStatus = "idle";
  let canceled = false;

  return {
    status() {
      return status;
    },
    cancel() {
      canceled = true;
      if (status !== "completed" && status !== "failed" && status !== "partial") {
        status = "canceled";
      }
    },
    async run(ticks = 20) {
      if (canceled) {
        status = "canceled";
        return status;
      }
      status = "scanning";
      for (let i = 0; i < ticks; i += 1) {
        if (canceled) {
          status = "canceled";
          return status;
        }
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
      }
      if (canceled) {
        status = "canceled";
        return status;
      }
      status = "completed";
      return status;
    },
  };
}
