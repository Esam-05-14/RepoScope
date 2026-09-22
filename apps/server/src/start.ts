import type { FastifyInstance } from "fastify";
import { defaultStoreRoot } from "@reposcope/engine";
import { buildApp } from "./app.js";
import type { Session } from "./session.js";

export const LOOPBACK_HOST = "127.0.0.1";

export interface StartServerOptions {
  session: Session;
  port?: number;
  staticRoot?: string;
  scanDelayMs?: number;
  persistRoot?: string;
}

export interface RunningServer {
  app: FastifyInstance;
  port: number;
  host: typeof LOOPBACK_HOST;
  close: () => Promise<void>;
}

export async function startServer(
  options: StartServerOptions,
): Promise<RunningServer> {
  const persistRoot =
    options.persistRoot ??
    (process.env.REPOSCOPE_PERSIST === "0" ? undefined : defaultStoreRoot());
  const app = await buildApp({
    session: options.session,
    staticRoot: options.staticRoot,
    scanDelayMs: options.scanDelayMs,
    persistRoot,
  });

  await app.listen({
    host: LOOPBACK_HOST,
    port: options.port ?? 8787,
  });

  const address = app.server.address();
  if (address === null || typeof address === "string") {
    await app.close();
    throw new Error("loopback server did not bind a TCP port");
  }

  options.session.boundPort = address.port;

  return {
    app,
    port: address.port,
    host: LOOPBACK_HOST,
    close: async () => {
      await app.close();
    },
  };
}
