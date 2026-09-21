import { readFileSync } from "node:fs";
import { compareSnapshots, importSnapshot } from "@reposcope/engine";

export function compareCommand(basePath: string, targetPath: string): void {
  const base = importSnapshot(JSON.parse(readFileSync(basePath, "utf8")));
  const target = importSnapshot(JSON.parse(readFileSync(targetPath, "utf8")));
  const comparison = compareSnapshots(base, target);
  process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
}
