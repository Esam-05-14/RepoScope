import type { FastifyInstance } from "fastify";
import type { EdgePolicy } from "@reposcope/contracts";
import { sendError } from "../errors.js";
import type { Session } from "../session.js";
import type { AnalysisStore } from "../store.js";
import { parseGitHubRepoInput } from "@reposcope/engine";
import { cancelScan, startScan, type ScanRequest, type ScanRunnerOptions } from "../scan-runner.js";

const EDGE_POLICIES = new Set<EdgePolicy>(["value-and-mixed", "include-type-only"]);

function asScanRequest(body: unknown): ScanRequest | { error: string } {
  if (body === undefined || body === null || body === "") {
    return {};
  }
  if (typeof body !== "object") {
    return { error: "scan body must be an object" };
  }
  const record = body as Record<string, unknown>;
  if ("root" in record || "path" in record || "directory" in record) {
    return { error: "filesystem paths are not accepted" };
  }
  const request: ScanRequest = {};
  if (record.fixture !== undefined) {
    if (typeof record.fixture !== "string") {
      return { error: "fixture must be an opaque id" };
    }
    request.fixture = record.fixture;
  }
  if (record.commit !== undefined) {
    if (typeof record.commit !== "string") {
      return { error: "commit must be a revision string" };
    }
    request.commit = record.commit;
  }
  if (record.edgePolicy !== undefined) {
    if (typeof record.edgePolicy !== "string" || !EDGE_POLICIES.has(record.edgePolicy as EdgePolicy)) {
      return { error: "edgePolicy is not supported" };
    }
    request.edgePolicy = record.edgePolicy as EdgePolicy;
  }
  if (record.github !== undefined) {
    if (typeof record.github !== "string") {
      return { error: "github must be a github.com locator" };
    }
    try {
      parseGitHubRepoInput(record.github);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "github must be a github.com locator",
      };
    }
    request.github = record.github;
  }
  if (request.github !== undefined && request.fixture !== undefined) {
    return { error: "github and fixture cannot be combined" };
  }
  if (record.incremental !== undefined) {
    if (typeof record.incremental !== "boolean") {
      return { error: "incremental must be a boolean" };
    }
    request.incremental = record.incremental;
  }
  if (record.previousSnapshotId !== undefined) {
    if (typeof record.previousSnapshotId !== "string") {
      return { error: "previousSnapshotId must be an opaque id" };
    }
    request.previousSnapshotId = record.previousSnapshotId;
  }
  if (record.includeDynamicImport !== undefined) {
    if (typeof record.includeDynamicImport !== "boolean") {
      return { error: "includeDynamicImport must be a boolean" };
    }
    request.includeDynamicImport = record.includeDynamicImport;
  }
  return request;
}

export function registerScanRoutes(
  app: FastifyInstance,
  session: Session,
  store: AnalysisStore,
  runner: ScanRunnerOptions = {},
): void {
  app.post("/api/scans", async (request, reply) => {
    const parsed = asScanRequest(request.body);
    if ("error" in parsed) {
      sendError(reply, 400, "VALIDATION_FAILED", parsed.error);
      return reply;
    }
    if (parsed.fixture !== undefined && session.fixtureCatalog[parsed.fixture] === undefined) {
      sendError(reply, 400, "VALIDATION_FAILED", "Unknown fixture id.");
      return reply;
    }
    const started = startScan(store, session, parsed, runner);
    if (started.error === "no-root") {
      sendError(reply, 400, "UNSUPPORTED_REPOSITORY", "No CLI-selected root is available.");
      return reply;
    }
    if (started.error === "busy") {
      sendError(reply, 409, "VALIDATION_FAILED", "A scan is already running.");
      return reply;
    }
    return reply.status(202).send({
      id: started.record.id,
      status: started.record.status,
    });
  });

  app.get("/api/scans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = store.scans.get(id);
    if (record === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Scan not found.");
      return reply;
    }
    return {
      id: record.id,
      status: record.status,
      snapshotId: record.snapshotId,
      phase: record.phase,
      discoveredFiles: record.discoveredFiles,
      analyzedFiles: record.analyzedFiles,
      reusedFiles: record.reusedFiles,
      message: record.message,
    };
  });

  app.delete("/api/scans/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = cancelScan(store, session, id);
    if (record === undefined) {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Scan not found.");
      return reply;
    }
    return { id: record.id, status: record.status };
  });

  app.get("/api/demo/fixtures", async (_request, reply) => {
    if (session.rootKind !== "demo") {
      sendError(reply, 404, "SCAN_NOT_FOUND", "Demo fixtures are not available.");
      return reply;
    }
    return {
      fixtures: Object.keys(session.fixtureCatalog).map((id) => ({ id })),
    };
  });
}
