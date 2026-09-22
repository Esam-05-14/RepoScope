#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PRODUCT_VERSION } from "@reposcope/contracts";
import { inspectCommand } from "./commands/inspect.js";
import { compareCommand } from "./commands/compare.js";
import { briefCommand } from "./commands/brief.js";
import { scanCommand } from "./commands/scan.js";

function webDistRoot(): string | undefined {
  const candidate = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../web/dist",
  );
  return existsSync(candidate) ? candidate : undefined;
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      demo: { type: "boolean", default: false },
      port: { type: "string" },
      out: { type: "string" },
      commit: { type: "string" },
      "no-open": { type: "boolean", default: false },
      reopen: { type: "boolean", default: false },
      full: { type: "boolean", default: false },
      libraries: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
      version: { type: "boolean", default: false, short: "v" },
    },
  });

  if (values.version === true) {
    process.stdout.write(`reposcope ${PRODUCT_VERSION}\n`);
    return;
  }

  if (values.help === true || positionals[0] === undefined) {
    process.stdout.write(
      "Usage:\n  reposcope inspect [path|github-url] [--demo] [--port 8787] [--reopen] [--no-open] [--commit rev]\n  reposcope scan [path|github-url] [--demo] [--out file] [--commit rev]\n  reposcope brief [path|github-url] [--demo] [--out file] [--full] [--libraries] [--commit rev]\n  reposcope compare <base.json> <target.json>\n  reposcope --version\n",
    );
    return;
  }

  const command = positionals[0];
  if (command === "scan") {
    await scanCommand({
      targetPath: positionals[1],
      demo: values.demo === true,
      out: values.out,
      commit: values.commit,
    });
    return;
  }
  if (command === "brief") {
    await briefCommand({
      targetPath: positionals[1],
      demo: values.demo === true,
      out: values.out,
      commit: values.commit,
      density: values.full === true ? "full" : "compact",
      lens: values.libraries === true ? "libraries" : "investigation",
    });
    return;
  }
  if (command === "compare") {
    if (positionals[1] === undefined || positionals[2] === undefined) {
      throw new Error("compare requires two snapshot files");
    }
    compareCommand(positionals[1], positionals[2]);
    return;
  }
  if (command !== "inspect") {
    throw new Error(`unknown command: ${command}`);
  }

  const port =
    values.port === undefined ? 8787 : Number.parseInt(values.port, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("port must be an integer between 0 and 65535");
  }

  const running = await inspectCommand({
    targetPath: positionals[1],
    demo: values.demo === true,
    port,
    open: values["no-open"] !== true,
    staticRoot: webDistRoot(),
    commit: values.commit,
    reopen: values.reopen === true,
  });
  const stop = (): void => {
    void running.close().then(() => {
      process.exit(0);
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

const invoked = fileURLToPath(import.meta.url);
const isEntry =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === invoked;

if (isEntry) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "cli failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

export { main };
