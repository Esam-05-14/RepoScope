import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createSession } from "@reposcope/server";
import type { FastifyInstance } from "fastify";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PORT = 8787;
const token = "d".repeat(64);

async function pollScan(
  app: FastifyInstance,
  id: string,
): Promise<{ status: string; snapshotId?: string }> {
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

describe("confined editor open", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it("opens a snapshot node under the selected root and rejects path traversal", async () => {
    const opened: string[] = [];
    const session = createSession({
      rootKind: "cli",
      rootLabel: "fixtures/esm-baseline",
      canonicalRoot: path.join(workspace, "fixtures", "esm-baseline"),
      token,
    });
    session.boundPort = PORT;
    const instance = await buildApp({
      session,
      openEditor: (input) => {
        opened.push(input.absolutePath);
      },
    });
    app = instance;

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
    const done = await pollScan(instance, id);
    expect(done.snapshotId).toBeDefined();

    const ok = await instance.inject({
      method: "POST",
      url: "/api/editor/open",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: { snapshotId: done.snapshotId, nodeId: "src/lib/money.ts", line: 1 },
    });
    expect(ok.statusCode).toBe(200);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.replaceAll("\\", "/")).toMatch(/fixtures\/esm-baseline\/src\/lib\/money\.ts$/);

    const rejected = await instance.inject({
      method: "POST",
      url: "/api/editor/open",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: { snapshotId: done.snapshotId, nodeId: "../package.json" },
    });
    expect(rejected.statusCode).toBe(400);
    expect(opened).toHaveLength(1);
  });
});
