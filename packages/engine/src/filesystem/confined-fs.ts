import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  type AnalysisFilesystemHost,
  type FileStat,
  type ReadAttempt,
} from "./host.js";
import { isInsideResolvedRoot, isUncPath } from "./paths.js";

export type { FileStat, ReadAttempt } from "./host.js";

const MAX_DENIED = 512;
const MAX_FILE_CACHE_BYTES = 32 * 1024 * 1024;

export class ConfinedFilesystemHost implements AnalysisFilesystemHost {
  readonly attempts: ReadAttempt[] = [];
  readonly deniedReads: string[] = [];
  private readonly resolvedRoot: string;
  private readonly confineCache = new Map<string, string | null>();
  private readonly statCache = new Map<string, FileStat | null>();
  private readonly dirCache = new Map<string, string[]>();
  private readonly fileCache = new Map<string, Buffer | null>();
  private fileCacheBytes = 0;

  constructor(readonly root: string) {
    this.resolvedRoot = path.resolve(root);
  }

  confine(candidate: string): string | null {
    if (candidate.includes("\0") || isUncPath(candidate)) {
      return null;
    }
    const resolved = path.resolve(this.resolvedRoot, candidate);
    const cached = this.confineCache.get(resolved);
    if (cached !== undefined) {
      return cached;
    }
    const allowed = isInsideResolvedRoot(this.resolvedRoot, resolved) ? resolved : null;
    this.confineCache.set(resolved, allowed);
    return allowed;
  }

  private auditDenied(fileName: string, reason: ReadAttempt["reason"]): void {
    if (this.deniedReads.length >= MAX_DENIED) {
      return;
    }
    this.attempts.push({ path: fileName, allowed: false, reason });
    this.deniedReads.push(fileName);
  }

  private statCached(confined: string): FileStat | null {
    const cached = this.statCache.get(confined);
    if (cached !== undefined) {
      return cached;
    }
    try {
      const stat = lstatSync(confined);
      const value: FileStat = {
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        isSymbolicLink: stat.isSymbolicLink(),
      };
      this.statCache.set(confined, value);
      return value;
    } catch {
      this.statCache.set(confined, null);
      return null;
    }
  }

  fileExists(fileName: string): boolean {
    const confined = this.confine(fileName);
    if (confined === null) {
      this.auditDenied(fileName, "outside-root");
      return false;
    }
    const stat = this.statCached(confined);
    if (stat === null) {
      return false;
    }
    if (stat.isSymbolicLink) {
      this.auditDenied(confined, "symlink");
      return false;
    }
    return stat.isFile;
  }

  directoryExists(directoryName: string): boolean {
    const confined = this.confine(directoryName);
    if (confined === null) {
      this.auditDenied(directoryName, "outside-root");
      return false;
    }
    const stat = this.statCached(confined);
    return stat !== null && stat.isDirectory && !stat.isSymbolicLink;
  }

  readFile(fileName: string): string | undefined {
    const bytes = this.readFileBytes(fileName);
    if (bytes === undefined) {
      return undefined;
    }
    try {
      return bytes.toString("utf8");
    } catch {
      return undefined;
    }
  }

  readFileBytes(fileName: string): Buffer | undefined {
    const confined = this.confine(fileName);
    if (confined === null) {
      this.auditDenied(fileName, "outside-root");
      return undefined;
    }
    const cached = this.fileCache.get(confined);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const stat = this.statCached(confined);
    if (stat === null) {
      this.fileCache.set(confined, null);
      return undefined;
    }
    if (stat.isSymbolicLink) {
      this.auditDenied(confined, "symlink");
      this.fileCache.set(confined, null);
      return undefined;
    }
    if (!stat.isFile) {
      this.auditDenied(confined, "not-a-file");
      this.fileCache.set(confined, null);
      return undefined;
    }
    try {
      const bytes = readFileSync(confined);
      if (this.fileCacheBytes + bytes.byteLength <= MAX_FILE_CACHE_BYTES) {
        this.fileCache.set(confined, bytes);
        this.fileCacheBytes += bytes.byteLength;
      }
      return bytes;
    } catch {
      this.fileCache.set(confined, null);
      return undefined;
    }
  }

  readDirectory(directoryName: string): string[] {
    const confined = this.confine(directoryName);
    if (confined === null) {
      this.auditDenied(directoryName, "outside-root");
      return [];
    }
    const cached = this.dirCache.get(confined);
    if (cached !== undefined) {
      return cached;
    }
    const stat = this.statCached(confined);
    if (stat === null || !stat.isDirectory || stat.isSymbolicLink) {
      const empty: string[] = [];
      this.dirCache.set(confined, empty);
      return empty;
    }
    try {
      const names = readdirSync(confined);
      this.dirCache.set(confined, names);
      return names;
    } catch {
      const empty: string[] = [];
      this.dirCache.set(confined, empty);
      return empty;
    }
  }

  realpath(fileName: string): string {
    const confined = this.confine(fileName);
    return confined ?? fileName;
  }

  getCurrentDirectory(): string {
    return this.root;
  }

  stat(fileName: string): FileStat | undefined {
    const confined = this.confine(fileName);
    if (confined === null) {
      this.auditDenied(fileName, "outside-root");
      return undefined;
    }
    return this.statCached(confined) ?? undefined;
  }
}
