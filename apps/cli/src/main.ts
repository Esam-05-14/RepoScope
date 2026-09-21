#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { inspectCommand } from "./commands/inspect.js";
import { compareCommand } from "./commands/compare.js";
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
      help: { type: "boolean", default: false },
    },
  });

  if (values.help === true || positionals[0] === undefined) {
    process.stdout.write(
      "Usage:\n  reposcope inspect [path] [--demo] [--port 8787] [--no-open]\n  reposcope scan [path] [--demo] [--out file] [--commit rev]\n  reposcope compare <base.json> <target.json>\n",
    );
    return;
  }

  const command = positionals[0];
  if (command === "scan") {
    scanCommand({
      targetPath: positionals[1],
      demo: values.demo === true,
      out: values.out,
      commit: values.commit,
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

  await inspectCommand({
    targetPath: positionals[1],
    demo: values.demo === true,
    port,
    open: values["no-open"] !== true,
    staticRoot: webDistRoot(),
  });
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
