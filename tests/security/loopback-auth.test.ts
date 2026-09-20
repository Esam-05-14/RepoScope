import { afterEach, describe, expect, it } from "vitest";
import { buildApp, createSession, startServer } from "@reposcope/server";
import type { FastifyInstance } from "fastify";

const PORT = 8787;

async function appWithSession(token = "a".repeat(64)): Promise<{
  app: FastifyInstance;
  token: string;
}> {
  const session = createSession({
    rootKind: "demo",
    rootLabel: "fixtures/esm-baseline",
    canonicalRoot: null,
    token,
  });
  session.boundPort = PORT;
  const app = await buildApp({ session });
  return { app, token };
}

describe("loopback auth boundary", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it("accepts a valid bearer token and loopback host", async () => {
    const started = await appWithSession();
    app = started.app;
    const response = await started.app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: `Bearer ${started.token}`,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      ok: boolean;
      bind: string;
      scan: { status: string };
      root: { kind: string; label: string };
    };
    expect(body.ok).toBe(true);
    expect(body.bind).toBe("127.0.0.1");
    expect(body.scan.status).toBe("idle");
    expect(body.root.label).toBe("fixtures/esm-baseline");
    expect(JSON.stringify(body)).not.toMatch(/[A-Za-z]:\\/);
  });

  it("rejects a missing token", async () => {
    const started = await appWithSession();
    app = started.app;
    const response = await started.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: `127.0.0.1:${PORT}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects a wrong token", async () => {
    const started = await appWithSession();
    app = started.app;
    const response = await started.app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        host: `127.0.0.1:${PORT}`,
        authorization: "Bearer wrong-token",
      },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects a wrong Host header", async () => {
    const started = await appWithSession();
    app = started.app;
    const response = await started.app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        host: "evil.example",
        authorization: `Bearer ${started.token}`,
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "INVALID_HOST" });
  });

  it("binds the HTTP server to 127.0.0.1 only", async () => {
    const session = createSession({
      rootKind: "demo",
      rootLabel: "fixtures/esm-baseline",
      canonicalRoot: null,
    });
    const server = await startServer({ session, port: 0 });
    try {
      expect(server.host).toBe("127.0.0.1");
      const response = await fetch(`http://127.0.0.1:${server.port}/api/health`, {
        headers: { authorization: `Bearer ${session.token}` },
      });
      expect(response.ok).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("rejects a wrong Origin header", async () => {
    const started = await appWithSession();
    app = started.app;
    const response = await started.app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        host: `127.0.0.1:${PORT}`,
        origin: "http://evil.example",
        authorization: `Bearer ${started.token}`,
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FORBIDDEN_ORIGIN" });
  });
});
