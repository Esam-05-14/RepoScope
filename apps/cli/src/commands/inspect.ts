import path from "node:path";
import { createSession, startServer } from "@reposcope/server";
import { bundledFixtures, canonicalizeDirectory, defaultStartDir, demoRoot } from "../root.js";
import { openBrowser } from "../open-browser.js";

export interface InspectOptions {
  targetPath?: string;
  demo?: boolean;
  port?: number;
  open?: boolean;
  staticRoot?: string;
}

export async function inspectCommand(
  options: InspectOptions,
): Promise<{ port: number; close: () => Promise<void> }> {
  const startDir = defaultStartDir();
  const selected = options.demo
    ? { ...demoRoot(startDir), kind: "demo" as const }
    : (() => {
        const canonicalRoot = canonicalizeDirectory(
          options.targetPath ?? process.cwd(),
        );
        return {
          canonicalRoot,
          label: path.basename(canonicalRoot),
          kind: "cli" as const,
        };
      })();

  const session = createSession({
    rootKind: selected.kind,
    rootLabel: selected.label,
    canonicalRoot: selected.canonicalRoot,
    fixtureCatalog: selected.kind === "demo" ? bundledFixtures(startDir) : {},
    token: process.env.REPOSCOPE_SESSION_TOKEN,
  });

  const server = await startServer({
    session,
    port: options.port ?? 8787,
    staticRoot: options.staticRoot,
  });

  const publicUrl = `http://127.0.0.1:${server.port}/`;
  process.stdout.write(
    `RepoScope listening on ${publicUrl} (loopback only). Session token is passed in the URL fragment and is not printed.\n`,
  );

  if (options.open !== false) {
    openBrowser(`${publicUrl}#token=${session.token}`);
  }

  return {
    port: server.port,
    close: server.close,
  };
}
