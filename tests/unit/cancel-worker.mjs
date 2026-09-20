import { parentPort } from "node:worker_threads";

if (parentPort === null) {
  throw new Error("worker requires parentPort");
}

let canceled = false;
let status = "idle";

parentPort.on("message", (message) => {
  if (message.type === "cancel") {
    canceled = true;
    status = "canceled";
    parentPort.postMessage({ type: "status", status });
    return;
  }
  if (message.type === "run-busy") {
    status = "scanning";
    const ticks = message.ticks ?? 20;
    let i = 0;
    const tick = () => {
      if (canceled) {
        status = "canceled";
        parentPort.postMessage({ type: "status", status });
        return;
      }
      if (i >= ticks) {
        status = canceled ? "canceled" : "completed";
        parentPort.postMessage({ type: "status", status });
        return;
      }
      i += 1;
      setImmediate(tick);
    };
    tick();
  }
});
