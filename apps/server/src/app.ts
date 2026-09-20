import { existsSync } from "node:fs";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerHealthRoute } from "./routes/health.js";
import { registerSecurity } from "./security.js";
import type { Session } from "./session.js";

export interface BuildAppOptions {
  session: Session;
  staticRoot?: string;
}

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const app = fastify({
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
