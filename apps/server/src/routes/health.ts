import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@reposcope/contracts";
import type { Session } from "../session.js";

export function registerHealthRoute(
  app: FastifyInstance,
  session: Session,
): void {
  app.get("/api/health", async () => {
    const body: HealthResponse = {
      ok: true,
      bind: "127.0.0.1",
      root: {
        kind: session.rootKind,
        label: session.rootLabel,
      },
      scan: {
        status: session.scanStatus,
      },
    };
    return body;
  });
}
