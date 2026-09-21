import type { FastifyInstance } from "fastify";
import { sendError } from "../errors.js";
import type { AnalysisStore } from "../store.js";
import type { Session } from "../session.js";

export function registerSessionRoutes(
  app: FastifyInstance,
  session: Session,
  store: AnalysisStore,
): void {
  app.delete("/api/session/analysis", async () => {
    store.scans.clear();
    store.snapshots.clear();
    store.activeScanId = null;
    session.scanStatus = "idle";
    return { ok: true };
  });

  app.get("/api/session", async (_request, reply) => {
    if (session.canonicalRoot === null && session.rootKind === "none") {
      sendError(reply, 400, "UNSUPPORTED_REPOSITORY", "No repository is selected.");
      return reply;
    }
    return {
      rootKind: session.rootKind,
      rootLabel: session.rootLabel,
      scanStatus: session.scanStatus,
      snapshotCount: store.snapshots.size,
    };
  });
}
