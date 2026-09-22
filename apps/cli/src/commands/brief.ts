import { writeFileSync } from "node:fs";
import { GitObjectFilesystemHost, investigationBriefMarkdown, scanRepository } from "@reposcope/engine";
import { defaultStartDir, demoRoot, resolveCliTarget } from "../root.js";

export interface BriefCommandOptions {
  targetPath?: string;
  demo?: boolean;
  out?: string;
  commit?: string;
  density?: "compact" | "full";
}

export async function briefCommand(options: BriefCommandOptions = {}): Promise<void> {
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
  const { markdown } = investigationBriefMarkdown(snapshot, options.density ?? "compact");
  if (options.out !== undefined) {
    writeFileSync(options.out, markdown, "utf8");
    return;
  }
  process.stdout.write(markdown);
}
