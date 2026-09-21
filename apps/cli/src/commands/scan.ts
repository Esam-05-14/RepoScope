import { writeFileSync } from "node:fs";
import {
  GitObjectFilesystemHost,
  exportSnapshot,
  scanRepository,
} from "@reposcope/engine";
import { canonicalizeDirectory, defaultStartDir, demoRoot } from "../root.js";

export interface ScanCommandOptions {
  targetPath?: string;
  demo?: boolean;
  out?: string;
  commit?: string;
}

export function scanCommand(options: ScanCommandOptions = {}): void {
  const startDir = defaultStartDir();
  const selected = options.demo
    ? demoRoot(startDir)
    : {
        canonicalRoot: canonicalizeDirectory(options.targetPath ?? process.cwd()),
        label: options.targetPath ?? process.cwd(),
      };
  const host =
    options.commit === undefined
      ? undefined
      : GitObjectFilesystemHost.open(selected.canonicalRoot, options.commit);
  const snapshot = scanRepository({
    root: selected.canonicalRoot,
    host,
    scopeKind: options.commit === undefined ? "working-tree" : "git-commit",
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
