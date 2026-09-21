import type { FastifyInstance } from "fastify";
import { evaluateBoundaryPolicy, type BoundaryPolicy } from "@reposcope/engine";
import { sendError } from "../errors.js";
import type { AnalysisStore } from "../store.js";

export function registerBoundaryRoutes(
  app: FastifyInstance,
  store: AnalysisStore,
): void {
  app.post("/api/boundaries/evaluate", async (request, reply) => {
    const body = request.body as { snapshotId?: string; policy?: BoundaryPolicy };
    if (typeof body.snapshotId !== "string" || body.policy === undefined) {
      sendError(reply, 400, "VALIDATION_FAILED", "snapshotId and policy are required.");
      return reply;
    }
    const stored = store.snapshots.get(body.snapshotId);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    if (
      typeof body.policy !== "object" ||
      body.policy === null ||
      typeof body.policy.groups !== "object" ||
      !Array.isArray(body.policy.forbid)
    ) {
      sendError(reply, 400, "VALIDATION_FAILED", "Boundary policy JSON is invalid.");
      return reply;
    }
    return {
      violations: evaluateBoundaryPolicy(stored.snapshot, body.policy),
    };
  });
}
