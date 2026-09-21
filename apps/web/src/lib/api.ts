import { getSessionToken } from "../session.js";
import type {
  AnalysisSnapshot,
  EvidenceResponse,
  HealthResponse,
  ScanProgressResponse,
  SnapshotComparison,
} from "@reposcope/contracts";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  if (token === null) {
    throw new ApiRequestError(401, "UNAUTHENTICATED", "A valid session token is required.");
  }
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json()) as T & { code?: string; message?: string };
  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      body.code ?? "SCAN_FAILED",
      body.message ?? "Request failed.",
    );
  }
  return body;
}

export function fetchHealth(): Promise<HealthResponse> {
  return request("/api/health");
}

export function startScan(body: Record<string, unknown> = {}): Promise<{ id: string; status: string }> {
  return request("/api/scans", { method: "POST", body: JSON.stringify(body) });
}

export function fetchScan(id: string): Promise<ScanProgressResponse> {
  return request(`/api/scans/${id}`);
}

export function cancelScan(id: string): Promise<{ id: string; status: string }> {
  return request(`/api/scans/${id}`, { method: "DELETE" });
}

export function fetchSnapshot(id: string): Promise<AnalysisSnapshot> {
  return request(`/api/snapshots/${id}`);
}

export function fetchImpact(
  snapshotId: string,
  node: string,
): Promise<{
  origin: string;
  directImporters: string[];
  transitiveImporters: string[];
  truncated: boolean;
  truncationReasons: string[];
  shortestObservedPathFrom: Record<string, string[]>;
}> {
  return request(`/api/snapshots/${snapshotId}/impact?node=${encodeURIComponent(node)}`);
}

export async function fetchEvidence(
  snapshotId: string,
  observationId: string,
): Promise<EvidenceResponse> {
  const token = getSessionToken();
  if (token === null) {
    throw new ApiRequestError(401, "UNAUTHENTICATED", "A valid session token is required.");
  }
  const response = await fetch(
    `/api/snapshots/${snapshotId}/evidence/${encodeURIComponent(observationId)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const body = (await response.json()) as EvidenceResponse & {
    code?: string;
    message?: string;
  };
  if (
    body.status === "current" ||
    body.status === "stale" ||
    body.status === "unavailable"
  ) {
    return body;
  }
  throw new ApiRequestError(
    response.status,
    body.code ?? "EVIDENCE_UNAVAILABLE",
    body.message ?? "Evidence is unavailable.",
  );
}

export function compareSnapshotsApi(
  baseId: string,
  targetId: string,
): Promise<SnapshotComparison> {
  return request("/api/compare", {
    method: "POST",
    body: JSON.stringify({ baseId, targetId }),
  });
}

export function importSnapshotApi(snapshot: unknown): Promise<{ id: string }> {
  return request("/api/snapshots/import", {
    method: "POST",
    body: JSON.stringify(snapshot),
  });
}

export function fetchDemoFixtures(): Promise<{ fixtures: { id: string }[] }> {
  return request("/api/demo/fixtures");
}

export function clearAnalysis(): Promise<{ ok: true }> {
  return request("/api/session/analysis", { method: "DELETE" });
}

export async function waitForScan(
  id: string,
  timeoutMs = 20_000,
): Promise<ScanProgressResponse> {
  const started = Date.now();
  for (;;) {
    const row = await fetchScan(id);
    if (
      row.status === "completed" ||
      row.status === "canceled" ||
      row.status === "failed" ||
      row.status === "partial"
    ) {
      return row;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error("scan timed out");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
  }
}
