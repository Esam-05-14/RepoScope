import { existsSync } from "node:fs";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerHealthRoute } from "./routes/health.js";
import { registerScanRoutes } from "./routes/scans.js";
import { registerSnapshotRoutes } from "./routes/snapshots.js";
import { registerEvidenceRoutes } from "./routes/evidence.js";
import { registerBoundaryRoutes } from "./routes/boundaries.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerSecurity } from "./security.js";
import type { Session } from "./session.js";
import { createAnalysisStore, type AnalysisStore } from "./store.js";

export interface BuildAppOptions {
  session: Session;
  staticRoot?: string;
  scanDelayMs?: number;
  store?: AnalysisStore;
}

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const store = options.store ?? createAnalysisStore();
  const app = fastify({
    bodyLimit: 2_000_000,
    logger:
      process.env.VITEST === "true"
        ? false
        : {
            level: "info",
            serializers: {
              req(request) {
                return { method: request.method, url: request.url };
              },
            },
          },
  });

  registerSecurity(app, options.session);
  registerHealthRoute(app, options.session);
  registerScanRoutes(app, options.session, store, options.scanDelayMs);
  registerSnapshotRoutes(app, store);
  registerEvidenceRoutes(app, store);
  registerBoundaryRoutes(app, store);
  registerSessionRoutes(app, options.session, store);

  if (options.staticRoot !== undefined && existsSync(options.staticRoot)) {
    const staticPlugin = await import("@fastify/static");
    await app.register(staticPlugin.default, {
      root: options.staticRoot,
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      const url = request.url.split("?")[0] ?? request.url;
      if (url.startsWith("/api/")) {
        void reply.status(404).send({
          code: "SCAN_NOT_FOUND",
          message: "Not found.",
          diagnosticId: "rs_notfound",
        });
        return;
      }
      void reply.sendFile("index.html");
    });
  }

  return app;
}
