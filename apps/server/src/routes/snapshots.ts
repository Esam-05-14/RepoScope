import type { FastifyInstance } from "fastify";
import {
  compareSnapshots,
  exportSnapshot,
  importSnapshot,
  fileRelationsFromSnapshot,
  impactFromSnapshot,
  investigationBriefMarkdown,
  relationsFromSnapshot,
  snapshotLabel,
} from "@reposcope/engine";
import { SnapshotValidationError } from "@reposcope/contracts";
import { sendError } from "../errors.js";
import { createOpaqueId, type AnalysisStore } from "../store.js";

export function registerSnapshotRoutes(
  app: FastifyInstance,
  store: AnalysisStore,
): void {
  app.get("/api/snapshots", async () => {
    return {
      items: [...store.snapshots.values()].map((stored) => ({
        id: stored.id,
        label: stored.label ?? snapshotLabel(stored.snapshot),
        graphDigest: stored.snapshot.graphDigest,
        selectedCommit: stored.snapshot.scope.selectedCommit,
      })),
    };
  });

  app.get("/api/snapshots/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = store.snapshots.get(id);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    return exportSnapshot(stored.snapshot);
  });

  app.get("/api/snapshots/:id/brief", async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = store.snapshots.get(id);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    const density =
      (request.query as { density?: string }).density === "full" ? "full" : "compact";
    const { brief, markdown } = investigationBriefMarkdown(stored.snapshot, density);
    const format = (request.query as { format?: string }).format;
    if (format === "md" || format === "markdown") {
      void reply.header("content-type", "text/markdown; charset=utf-8");
      void reply.header(
        "content-disposition",
        `attachment; filename="reposcope-${id.slice(0, 12)}-brief.md"`,
      );
      return reply.send(markdown);
    }
    return { brief, markdown };
  });

  app.get("/api/snapshots/:id/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = store.snapshots.get(id);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    const body = exportSnapshot(stored.snapshot);
    void reply.header("content-type", "application/json; charset=utf-8");
    void reply.header(
      "content-disposition",
      `attachment; filename="reposcope-${id.slice(0, 12)}.json"`,
    );
    return body;
  });

  app.post("/api/snapshots/import", async (request, reply) => {
    try {
      const snapshot = importSnapshot(request.body);
      const id = createOpaqueId("snap");
      snapshot.scanId = id;
      snapshot.scope = { ...snapshot.scope, kind: "imported-snapshot" };
      store.snapshots.set(id, {
        id,
        snapshot,
        readRoot: null,
        label: snapshotLabel(snapshot),
      });
      return reply.status(201).send({ id });
    } catch (error) {
      const message =
        error instanceof SnapshotValidationError ? error.message : "Snapshot is not compatible.";
      sendError(reply, 400, "SNAPSHOT_INCOMPATIBLE", message);
      return reply;
    }
  });

  app.get("/api/snapshots/:id/impact", async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = store.snapshots.get(id);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    const node = (request.query as { node?: string }).node;
    if (node === undefined || node === "") {
      sendError(reply, 400, "VALIDATION_FAILED", "node query parameter is required.");
      return reply;
    }
    if (!stored.snapshot.nodes.some((item) => item.id === node)) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Node is not in this snapshot.");
      return reply;
    }
    const impact = impactFromSnapshot(stored.snapshot, node);
    const shortestObservedPathFrom: Record<string, string[]> = {};
    for (const importer of [...impact.directImporters, ...impact.transitiveImporters]) {
      const path = impact.shortestPathFrom(importer);
      if (path !== undefined) {
        shortestObservedPathFrom[importer] = path;
      }
    }
    return {
      origin: impact.origin,
      directImporters: [...impact.directImporters],
      transitiveImporters: [...impact.transitiveImporters],
      truncated: impact.truncated,
      truncationReasons: [...impact.truncationReasons],
      shortestObservedPathFrom,
    };
  });

  app.get("/api/snapshots/:id/relations", async (request, reply) => {
    const { id } = request.params as { id: string };
    const stored = store.snapshots.get(id);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    const relations = relationsFromSnapshot(stored.snapshot);
    const node = (request.query as { node?: string }).node;
    const file =
      node !== undefined && node !== ""
        ? fileRelationsFromSnapshot(stored.snapshot, node)
        : undefined;
    if (node !== undefined && node !== "" && file === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Node is not in this snapshot.");
      return reply;
    }
    return { relations, file };
  });

  app.post("/api/compare", async (request, reply) => {
    const body = request.body as { baseId?: string; targetId?: string };
    if (typeof body.baseId !== "string" || typeof body.targetId !== "string") {
      sendError(reply, 400, "VALIDATION_FAILED", "baseId and targetId are required.");
      return reply;
    }
    const base = store.snapshots.get(body.baseId);
    const target = store.snapshots.get(body.targetId);
    if (base === undefined || target === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    return compareSnapshots(base.snapshot, target.snapshot);
  });
}
