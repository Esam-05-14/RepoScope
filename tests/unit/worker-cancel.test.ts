import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCancellableJob } from "@reposcope/server";

describe("S4 worker cancellation", () => {
  it("does not mark a canceled in-process job completed", async () => {
    const job = createCancellableJob();
    const run = job.run(50);
    job.cancel();
    await expect(run).resolves.toBe("canceled");
    expect(job.status()).toBe("canceled");
    expect(job.status()).not.toBe("completed");
  });

  it("cancels a worker_threads busy loop before completed", async () => {
    const worker = new Worker(
      fileURLToPath(new URL("./cancel-worker.mjs", import.meta.url)),
    );
    try {
      worker.postMessage({ type: "run-busy", ticks: 2000 });
      worker.postMessage({ type: "cancel" });
      const [message] = (await once(worker, "message")) as [
        { type: string; status: string },
      ];
      expect(message.status).toBe("canceled");
      expect(message.status).not.toBe("completed");
    } finally {
      await worker.terminate();
    }
  });
});
