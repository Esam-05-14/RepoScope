import type { FastifyInstance } from "fastify";
import {
  ConfinedFilesystemHost,
  GitObjectFilesystemHost,
  readEvidence,
} from "@reposcope/engine";
import { sendError } from "../errors.js";
import type { AnalysisStore } from "../store.js";

export function registerEvidenceRoutes(
  app: FastifyInstance,
  store: AnalysisStore,
): void {
  app.get("/api/snapshots/:snapshotId/evidence/:observationId", async (request, reply) => {
    const { snapshotId, observationId } = request.params as {
      snapshotId: string;
      observationId: string;
    };
    const stored = store.snapshots.get(snapshotId);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    const observation = stored.snapshot.observations.find((item) => item.id === observationId);
    if (observation === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Observation not found.");
      return reply;
    }
    const node = stored.snapshot.nodes.find((item) => item.id === observation.importerId);
    if (node === undefined || stored.readRoot === null) {
      sendError(
        reply,
        409,
        "EVIDENCE_UNAVAILABLE",
        "Evidence is unavailable for this snapshot.",
      );
      return reply;
    }
    const host =
      stored.commit === undefined
        ? new ConfinedFilesystemHost(stored.readRoot)
        : GitObjectFilesystemHost.open(stored.readRoot, stored.commit);
    const slice = readEvidence({
      host,
      importerId: observation.importerId,
      observation,
      expectedHash: node.contentHash,
    });
    if (slice.status === "stale") {
      return reply.status(409).send({
        ...slice,
        code: "EVIDENCE_STALE",
        message: "The file hash no longer matches this snapshot.",
        diagnosticId: "rs_evidence_stale",
      });
    }
    if (slice.status === "unavailable") {
      return reply.status(409).send({
        ...slice,
        code: "EVIDENCE_UNAVAILABLE",
        message: "Evidence could not be read under the current configuration.",
        diagnosticId: "rs_evidence_unavailable",
      });
    }
    return slice;
  });
}
