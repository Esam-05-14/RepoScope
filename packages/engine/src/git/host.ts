import path from "node:path";
import {
  type AnalysisFilesystemHost,
  type FileStat,
  type ReadAttempt,
} from "../filesystem/host.js";
import { isInsideRoot, isUncPath, toPosixRelative } from "../filesystem/paths.js";
import { gitExec, resolveCommit } from "./exec.js";

interface GitBlob {
  oid: string;
  mode: string;
}

const SYMLINK_MODE = "120000";

export class GitObjectFilesystemHost implements AnalysisFilesystemHost {
  readonly attempts: ReadAttempt[] = [];
  readonly deniedReads: string[] = [];
  readonly commit: string;
  private readonly blobs = new Map<string, GitBlob>();
  private readonly directories = new Set<string>([""]);
  private readonly cache = new Map<string, Buffer>();

  constructor(
    readonly root: string,
    commit: string,
    entries: readonly { path: string; oid: string; mode: string }[],
  ) {
    this.commit = commit;
    for (const entry of entries) {
      const relative = entry.path.replaceAll("\\", "/");
      if (relative.startsWith("/") || relative.includes("..")) {
        continue;
      }
      this.blobs.set(relative, { oid: entry.oid, mode: entry.mode });
      const parts = relative.split("/");
      let prefix = "";
      for (let i = 0; i < parts.length - 1; i += 1) {
        prefix = prefix === "" ? (parts[i] ?? "") : `${prefix}/${parts[i]}`;
        this.directories.add(prefix);
      }
    }
  }

  static open(root: string, rev: string): GitObjectFilesystemHost {
    const commit = resolveCommit(root, rev);
    const raw = gitExec(root, ["ls-tree", "-r", "-z", "--full-tree", commit]);
    const entries: { path: string; oid: string; mode: string }[] = [];
    let offset = 0;
    while (offset < raw.length) {
      const zero = raw.indexOf(0, offset);
      const end = zero === -1 ? raw.length : zero;
      const record = raw.subarray(offset, end).toString("utf8");
      offset = end + 1;
      if (record === "") {
        continue;
      }
      const tab = record.indexOf("\t");
      if (tab === -1) {
        continue;
      }
      const meta = record.slice(0, tab).split(" ");
      const filePath = record.slice(tab + 1);
      const mode = meta[0];
      const type = meta[1];
      const oid = meta[2];
      if (type !== "blob" || mode === undefined || oid === undefined) {
        continue;
      }
      entries.push({ path: filePath, oid, mode });
    }
    return new GitObjectFilesystemHost(root, commit, entries);
  }

  confine(candidate: string): string | null {
    if (candidate.includes("\0") || isUncPath(candidate)) {
      return null;
    }
    const resolved = path.resolve(this.root, candidate);
    if (!isInsideRoot(this.root, resolved)) {
      return null;
    }
    return resolved;
  }

  private relativeOf(fileName: string): string | null {
    const confined = this.confine(fileName);
    if (confined === null) {
      return null;
    }
    return toPosixRelative(this.root, confined);
  }

  private audit(fileName: string, allowed: boolean, reason?: ReadAttempt["reason"]): void {
    this.attempts.push({ path: fileName, allowed, reason });
    if (!allowed) {
      this.deniedReads.push(fileName);
    }
  }

  private blob(relative: string): GitBlob | undefined {
    return this.blobs.get(relative);
  }

  fileExists(fileName: string): boolean {
    const relative = this.relativeOf(fileName);
    if (relative === null) {
      return false;
    }
    const blob = this.blob(relative);
    if (blob === undefined || blob.mode === SYMLINK_MODE) {
      return false;
    }
    return true;
  }

  directoryExists(directoryName: string): boolean {
    const relative = this.relativeOf(directoryName);
    if (relative === null) {
      return false;
    }
    return this.directories.has(relative);
  }

  stat(fileName: string): FileStat | undefined {
    const relative = this.relativeOf(fileName);
    if (relative === null) {
      return undefined;
    }
    const blob = this.blob(relative);
    if (blob !== undefined) {
      return {
        isFile: blob.mode !== SYMLINK_MODE,
        isDirectory: false,
        isSymbolicLink: blob.mode === SYMLINK_MODE,
      };
    }
    if (this.directories.has(relative)) {
      return { isFile: false, isDirectory: true, isSymbolicLink: false };
    }
    return undefined;
  }

  readFileBytes(fileName: string): Buffer | undefined {
    const relative = this.relativeOf(fileName);
    if (relative === null) {
      return undefined;
    }
    const blob = this.blob(relative);
    if (blob === undefined || blob.mode === SYMLINK_MODE) {
      this.audit(fileName, false, blob?.mode === SYMLINK_MODE ? "symlink" : "missing");
      return undefined;
    }
    const cached = this.cache.get(blob.oid);
    if (cached !== undefined) {
      this.audit(fileName, true);
      return cached;
    }
    const bytes = gitExec(this.root, ["cat-file", "blob", blob.oid]);
    this.cache.set(blob.oid, bytes);
    this.audit(fileName, true);
    return bytes;
  }

  readFile(fileName: string): string | undefined {
    const bytes = this.readFileBytes(fileName);
    if (bytes === undefined) {
      return undefined;
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return undefined;
    }
  }

  readDirectory(directoryName: string): string[] {
    const relative = this.relativeOf(directoryName);
    if (relative === null) {
      return [];
    }
    const prefix = relative === "" ? "" : `${relative}/`;
    const names = new Set<string>();
    for (const path of this.blobs.keys()) {
      if (prefix !== "" && !path.startsWith(prefix)) {
        continue;
      }
      if (prefix === "" && path === "") {
        continue;
      }
      const rest = prefix === "" ? path : path.slice(prefix.length);
      if (rest === "") {
        continue;
      }
      const slash = rest.indexOf("/");
      names.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    for (const dir of this.directories) {
      if (prefix !== "" && !dir.startsWith(prefix)) {
        continue;
      }
      if (dir === relative) {
        continue;
      }
      const rest = prefix === "" ? dir : dir.slice(prefix.length);
      if (rest === "" || rest.includes("/")) {
        continue;
      }
      names.add(rest);
    }
    return [...names].sort();
  }

  realpath(fileName: string): string {
    return this.confine(fileName) ?? fileName;
  }

  getCurrentDirectory(): string {
    return this.root;
  }
}
