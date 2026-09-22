import { writeFileSync } from "node:fs";
import {
  GitObjectFilesystemHost,
  exportSnapshot,
  scanRepository,
} from "@reposcope/engine";
import { defaultStartDir, demoRoot, resolveCliTarget } from "../root.js";

export interface ScanCommandOptions {
  targetPath?: string;
  demo?: boolean;
  out?: string;
  commit?: string;
}

export async function scanCommand(options: ScanCommandOptions = {}): Promise<void> {
  const startDir = defaultStartDir();
  const selected = options.demo
    ? { ...demoRoot(startDir), kind: "cli" as const }
    : await resolveCliTarget(options.targetPath, options.commit);
  const host =
    options.commit === undefined || selected.kind === "github"
      ? undefined
      : GitObjectFilesystemHost.open(selected.canonicalRoot, options.commit);
  const snapshot = scanRepository({
    root: selected.canonicalRoot,
    host,
    scopeKind: host === undefined ? "working-tree" : "git-commit",
    selectedCommit: host?.commit,
  });
  const exported = exportSnapshot(snapshot);
  const json = `${JSON.stringify(exported, null, 2)}\n`;
  if (options.out !== undefined) {
    writeFileSync(options.out, json, "utf8");
    return;
  }
  process.stdout.write(json);
}
