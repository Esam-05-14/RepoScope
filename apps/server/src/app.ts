import { existsSync } from "node:fs";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { defaultOpenEditor, type OpenEditor } from "./editor.js";
import { hydratePersistedSnapshots } from "./persist-hydrate.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerScanRoutes } from "./routes/scans.js";
import { registerSnapshotRoutes } from "./routes/snapshots.js";
import { registerEvidenceRoutes } from "./routes/evidence.js";
import { registerBoundaryRoutes } from "./routes/boundaries.js";
import { registerEditorRoutes } from "./routes/editor.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerSecurity } from "./security.js";
import type { Session } from "./session.js";
import type { CloneGitHub } from "./scan-runner.js";
import { createAnalysisStore, type AnalysisStore } from "./store.js";

export function redactRequestUrl(url: string): string {
  const noHash = url.split("#")[0] ?? url;
  return noHash.replace(/([?&](?:token|access_token|authorization)=)[^&]*/gi, "$1[redacted]");
}

export interface BuildAppOptions {
  session: Session;
  staticRoot?: string;
  scanDelayMs?: number;
  store?: AnalysisStore;
  cloneGitHub?: CloneGitHub;
  persistRoot?: string;
  openEditor?: OpenEditor;
}

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const store = options.store ?? createAnalysisStore();
  if (options.persistRoot !== undefined) {
    hydratePersistedSnapshots(store, options.persistRoot, options.session);
  }
  const app = fastify({
    bodyLimit: 2_000_000,
    logger:
      process.env.VITEST === "true"
        ? false
        : {
            level: "info",
            redact: {
              paths: ["req.headers.authorization", "req.headers.cookie"],
              censor: "[redacted]",
            },
            serializers: {
              req(request) {
                return { method: request.method, url: redactRequestUrl(request.url) };
              },
            },
          },
  });

  registerSecurity(app, options.session);
  registerHealthRoute(app, options.session);
  registerScanRoutes(app, options.session, store, {
    delayMs: options.scanDelayMs,
    cloneGitHub: options.cloneGitHub,
    persistRoot: options.persistRoot,
  });
  registerSnapshotRoutes(app, store);
  registerEvidenceRoutes(app, store);
  registerBoundaryRoutes(app, store);
  registerEditorRoutes(app, store, options.openEditor ?? defaultOpenEditor);
  registerSessionRoutes(app, options.session, store, options.persistRoot);

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
