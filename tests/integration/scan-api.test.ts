import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createSession } from "@reposcope/server";
import type { FastifyInstance } from "fastify";
import type { AnalysisSnapshot } from "@reposcope/contracts";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PORT = 8787;
const token = "b".repeat(64);

function fixtures(): Record<string, string> {
  return {
    "esm-baseline": path.join(workspace, "fixtures", "esm-baseline"),
    "esm-revised": path.join(workspace, "fixtures", "esm-revised"),
    "unresolved-import": path.join(workspace, "fixtures", "unresolved-import"),
  };
}

async function pollScan(app: FastifyInstance, id: string): Promise<{
  status: string;
  snapshotId?: string;
}> {
  for (let i = 0; i < 200; i += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/api/scans/${id}`,
      headers: { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${token}` },
    });
    const body = response.json() as { status: string; snapshotId?: string };
    if (body.status !== "scanning" && body.status !== "idle") {
      return body;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 15);
    });
  }
  throw new Error("scan did not finish");
}

describe("scan API", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  async function start(delayMs?: number): Promise<FastifyInstance> {
    const session = createSession({
      rootKind: "demo",
      rootLabel: "fixtures/esm-baseline",
      canonicalRoot: path.join(workspace, "fixtures", "esm-baseline"),
      fixtureCatalog: fixtures(),
      token,
    });
    session.boundPort = PORT;
    const instance = await buildApp({ session, scanDelayMs: delayMs });
    app = instance;
    return instance;
  }

  it("scans the CLI root without accepting a path in the body", async () => {
    const instance = await start();
    const rejected = await instance.inject({
      method: "POST",
      url: "/api/scans",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: { root: "C:\\\\evil" },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ code: "VALIDATION_FAILED" });

    const created = await instance.inject({
      method: "POST",
      url: "/api/scans",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(created.statusCode).toBe(202);
    const id = (created.json() as { id: string }).id;
    const done = await pollScan(instance, id);
    expect(done.status).toBe("completed");
    expect(done.snapshotId).toBeDefined();
    const snapshotResponse = await instance.inject({
      method: "GET",
      url: `/api/snapshots/${done.snapshotId}`,
      headers: { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${token}` },
    });
    const snapshot = snapshotResponse.json() as AnalysisSnapshot;
    expect(snapshot.nodes.map((node) => node.id)).toContain("src/lib/money.ts");
    expect(JSON.stringify(snapshot)).not.toMatch(/[A-Za-z]:\\/);
    expect(snapshot).not.toHaveProperty("sourceText");

    const impact = await instance.inject({
      method: "GET",
      url: `/api/snapshots/${done.snapshotId}/impact?node=src/lib/money.ts`,
      headers: { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${token}` },
    });
    expect(impact.json()).toMatchObject({
      origin: "src/lib/money.ts",
      directImporters: ["src/app.ts"],
    });
    const observation = snapshot.observations.find(
      (item) => item.importerId === "src/app.ts" && item.resolution.targetId === "src/lib/money.ts",
    );
    expect(observation).toBeDefined();
    const evidence = await instance.inject({
      method: "GET",
      url: `/api/snapshots/${done.snapshotId}/evidence/${encodeURIComponent(observation?.id ?? "")}`,
      headers: { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${token}` },
    });
    expect(evidence.statusCode).toBe(200);
    expect(evidence.json()).toMatchObject({ status: "current" });
    expect(String((evidence.json() as { snippet?: string }).snippet)).toContain("./lib/money.js");
  });

  it("does not mark a canceled scan completed", async () => {
    const instance = await start(250);
    const created = await instance.inject({
      method: "POST",
      url: "/api/scans",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    const id = (created.json() as { id: string }).id;
    const canceled = await instance.inject({
      method: "DELETE",
      url: `/api/scans/${id}`,
      headers: { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${token}` },
    });
    expect(canceled.json()).toMatchObject({ status: "canceled" });
    const done = await pollScan(instance, id);
    expect(done.status).toBe("canceled");
    expect(done.status).not.toBe("completed");
  });

  it("rejects non-github locators and accepts a github scan via injected clone", async () => {
    const session = createSession({
      rootKind: "cli",
      rootLabel: "local",
      canonicalRoot: path.join(workspace, "fixtures", "esm-baseline"),
      token,
    });
    session.boundPort = PORT;
    const instance = await buildApp({
      session,
      cloneGitHub: async ({ spec }) => ({
        root: path.join(workspace, "fixtures", "esm-baseline"),
        label: spec.label,
        spec,
      }),
    });
    app = instance;

    const rejected = await instance.inject({
      method: "POST",
      url: "/api/scans",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: { github: "https://evil.example/acme/box" },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ code: "VALIDATION_FAILED" });

    const created = await instance.inject({
      method: "POST",
      url: "/api/scans",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: { github: "https://github.com/acme/box" },
    });
    expect(created.statusCode).toBe(202);
    const done = await pollScan(instance, (created.json() as { id: string }).id);
    expect(done.status).toBe("completed");
    expect(session.rootKind).toBe("github");
    expect(session.rootLabel).toBe("github.com/acme/box");
  });
});

