import type { FastifyInstance } from "fastify";
import { sendError } from "../errors.js";
import { confinedEditorPath, type OpenEditor } from "../editor.js";
import type { AnalysisStore } from "../store.js";

export function registerEditorRoutes(
  app: FastifyInstance,
  store: AnalysisStore,
  openEditor: OpenEditor,
): void {
  app.post("/api/editor/open", async (request, reply) => {
    const body = request.body as {
      snapshotId?: unknown;
      nodeId?: unknown;
      line?: unknown;
      column?: unknown;
    };
    if (typeof body.snapshotId !== "string" || typeof body.nodeId !== "string") {
      sendError(reply, 400, "VALIDATION_FAILED", "snapshotId and nodeId are required.");
      return reply;
    }
    if (
      body.nodeId.includes("\\") ||
      body.nodeId.includes("\0") ||
      body.nodeId.startsWith("/") ||
      body.nodeId.split("/").includes("..")
    ) {
      sendError(reply, 400, "VALIDATION_FAILED", "nodeId must be a snapshot-relative path.");
      return reply;
    }
    const stored = store.snapshots.get(body.snapshotId);
    if (stored === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Snapshot not found.");
      return reply;
    }
    if (stored.readRoot === null) {
      sendError(
        reply,
        400,
        "UNSUPPORTED_REPOSITORY",
        "Imported snapshots have no local files to open.",
      );
      return reply;
    }
    if (!stored.snapshot.nodes.some((node) => node.id === body.nodeId)) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Node is not in this snapshot.");
      return reply;
    }
    const absolutePath = confinedEditorPath(stored.readRoot, body.nodeId);
    if (absolutePath === null) {
      sendError(reply, 400, "VALIDATION_FAILED", "Path is outside the selected root.");
      return reply;
    }
    const line = typeof body.line === "number" && Number.isInteger(body.line) ? body.line : undefined;
    const column =
      typeof body.column === "number" && Number.isInteger(body.column) ? body.column : undefined;
    openEditor({ absolutePath, line, column });
    return { ok: true };
  });
}
