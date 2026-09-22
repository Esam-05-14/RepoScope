import { createSession, startServer } from "@reposcope/server";
import { bundledFixtures, defaultStartDir, demoRoot, resolveCliTarget } from "../root.js";
import { openBrowser } from "../open-browser.js";
import {
  clearInspectLock,
  livingInspectLock,
  readInspectLock,
  writeInspectLock,
} from "../inspect-lock.js";

export interface InspectOptions {
  targetPath?: string;
  demo?: boolean;
  port?: number;
  open?: boolean;
  staticRoot?: string;
  commit?: string;
  reopen?: boolean;
}

export function isAddressInUse(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    if ((error as { code?: unknown }).code === "EADDRINUSE") {
      return true;
    }
  }
  return error instanceof Error && error.message.includes("EADDRINUSE");
}

function attachExisting(
  lock: { port: number; token: string },
  open: boolean,
): { port: number; close: () => Promise<void>; reused: true } {
  const publicUrl = `http://127.0.0.1:${lock.port}/`;
  process.stdout.write(
    `Reopening existing RepoScope session on ${publicUrl} (loopback only). Session token is not printed.\n`,
  );
  if (open) {
    openBrowser(`${publicUrl}#token=${lock.token}`);
  }
  return {
    port: lock.port,
    reused: true,
    close: async () => {
      /* the living server owns the port */
    },
  };
}

export async function inspectCommand(
  options: InspectOptions,
): Promise<{ port: number; close: () => Promise<void>; reused?: boolean }> {
  const requestedPort = options.port ?? 8787;
  const ephemeral = requestedPort === 0;
  const shouldOpen = options.open !== false;

  if (!ephemeral && options.reopen === true) {
    const lock = livingInspectLock(requestedPort);
    if (lock === undefined) {
      throw new Error(
        `no living inspect session on port ${requestedPort}. Start one with reposcope inspect.`,
      );
    }
    return attachExisting(lock, shouldOpen);
  }

  const startDir = defaultStartDir();
  const selected = options.demo
    ? { ...demoRoot(startDir), kind: "demo" as const }
    : await resolveCliTarget(options.targetPath, options.commit);

  const session = createSession({
    rootKind: selected.kind,
    rootLabel: selected.label,
    canonicalRoot: selected.canonicalRoot,
    fixtureCatalog: selected.kind === "demo" ? bundledFixtures(startDir) : {},
    token: process.env.REPOSCOPE_SESSION_TOKEN,
  });

  if (options.staticRoot === undefined) {
    process.stderr.write(
      "Prebuilt UI not found (apps/web/dist). Run npm run build, then retry.\n",
    );
  }

  let server;
  try {
    server = await startServer({
      session,
      port: requestedPort,
      staticRoot: options.staticRoot,
    });
  } catch (error) {
    if (!ephemeral && isAddressInUse(error)) {
      const lock = livingInspectLock(requestedPort);
      if (lock !== undefined) {
        return attachExisting(lock, shouldOpen);
      }
      throw new Error(
        `port ${requestedPort} is already in use. Use reposcope inspect --reopen to attach to the existing session. RepoScope does not hop ports.`,
      );
    }
    throw error;
  }

  if (!ephemeral) {
    writeInspectLock({
      pid: process.pid,
      port: server.port,
      token: session.token,
    });
  }

  const publicUrl = `http://127.0.0.1:${server.port}/`;
  process.stdout.write(
    `RepoScope listening on ${publicUrl} (loopback only). Session token is passed in the URL fragment and is not printed.\n`,
  );
  if (selected.kind === "github") {
    process.stdout.write(`Cloned ${selected.label} into a local cache for read-only analysis.\n`);
  }

  if (shouldOpen) {
    openBrowser(`${publicUrl}#token=${session.token}`);
  }

  return {
    port: server.port,
    close: async () => {
      await server.close();
      if (!ephemeral) {
        const lock = readInspectLock(server.port);
        if (lock?.pid === process.pid) {
          clearInspectLock(server.port);
        }
      }
    },
  };
}
