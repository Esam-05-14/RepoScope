import { parentPort } from "node:worker_threads";
import {
  createCancellableJob,
  type WorkerInbound,
  type WorkerOutbound,
} from "./protocol.js";

if (parentPort === null) {
  throw new Error("analysis-worker must run as a worker thread");
}

const job = createCancellableJob();
const port = parentPort;

function emit(status: WorkerOutbound["status"]): void {
  const message: WorkerOutbound = { type: "status", status };
  port.postMessage(message);
}

port.on("message", (message: WorkerInbound) => {
  if (message.type === "cancel") {
    job.cancel();
    emit(job.status());
    return;
  }
  if (message.type === "run-busy") {
    void job.run(message.ticks).then((status) => {
      emit(status);
    });
  }
});
