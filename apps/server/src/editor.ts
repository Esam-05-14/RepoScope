import { execFile } from "node:child_process";
import path from "node:path";
import { ConfinedFilesystemHost } from "@reposcope/engine";

export interface OpenEditorInput {
  absolutePath: string;
  line?: number;
  column?: number;
}

export type OpenEditor = (input: OpenEditorInput) => void;

export function defaultOpenEditor(input: OpenEditorInput): void {
  const command =
    process.env.REPOSCOPE_EDITOR !== undefined && process.env.REPOSCOPE_EDITOR !== ""
      ? process.env.REPOSCOPE_EDITOR
      : "code";
  const args =
    input.line !== undefined
      ? ["-g", `${input.absolutePath}:${input.line}:${input.column ?? 1}`]
      : [input.absolutePath];
  execFile(command, args, { windowsHide: true }, () => {
    // Launch only. Do not wait on the editor process.
  });
}

export function confinedEditorPath(
  readRoot: string,
  nodeId: string,
): string | null {
  const host = new ConfinedFilesystemHost(readRoot);
  const candidate = path.resolve(readRoot, nodeId);
  return host.confine(candidate);
}
