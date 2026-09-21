import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { FilesystemHost } from "@reposcope/parser-ts";
import { isInsideRoot, isUncPath } from "./paths.js";

export interface ReadAttempt {
  path: string;
  allowed: boolean;
  reason?: "outside-root" | "symlink" | "missing" | "not-a-file";
}

export class ConfinedFilesystemHost implements FilesystemHost {
  readonly attempts: ReadAttempt[] = [];
  readonly deniedReads: string[] = [];

  constructor(readonly root: string) {}

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

  private audit(fileName: string, allowed: boolean, reason?: ReadAttempt["reason"]): void {
    this.attempts.push({ path: fileName, allowed, reason });
    if (!allowed) {
      this.deniedReads.push(fileName);
    }
  }

  fileExists(fileName: string): boolean {
    const confined = this.confine(fileName);
    if (confined === null) {
      this.audit(fileName, false, "outside-root");
      return false;
    }
    try {
      const stat = lstatSync(confined);
      if (stat.isSymbolicLink()) {
        this.audit(confined, false, "symlink");
        return false;
      }
      return stat.isFile();
    } catch {
      return false;
    }
  }

  directoryExists(directoryName: string): boolean {
    const confined = this.confine(directoryName);
    if (confined === null) {
      this.audit(directoryName, false, "outside-root");
      return false;
    }
    try {
      const stat = lstatSync(confined);
      return stat.isDirectory() && !stat.isSymbolicLink();
    } catch {
      return false;
    }
  }

  readFile(fileName: string): string | undefined {
    const confined = this.confine(fileName);
    if (confined === null) {
      this.audit(fileName, false, "outside-root");
      return undefined;
    }
    try {
      const stat = lstatSync(confined);
      if (stat.isSymbolicLink()) {
        this.audit(confined, false, "symlink");
        return undefined;
      }
      if (!stat.isFile()) {
        this.audit(confined, false, "not-a-file");
        return undefined;
      }
      this.audit(confined, true);
      return readFileSync(confined, "utf8");
    } catch {
      this.audit(confined, false, "missing");
      return undefined;
    }
  }

  readFileBytes(fileName: string): Buffer | undefined {
    const confined = this.confine(fileName);
    if (confined === null) {
      this.audit(fileName, false, "outside-root");
      return undefined;
    }
    try {
      const stat = lstatSync(confined);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        this.audit(confined, false, stat.isSymbolicLink() ? "symlink" : "not-a-file");
        return undefined;
      }
      this.audit(confined, true);
      return readFileSync(confined);
    } catch {
      this.audit(confined, false, "missing");
      return undefined;
    }
  }

  readDirectory(directoryName: string): string[] {
    const confined = this.confine(directoryName);
    if (confined === null) {
      this.audit(directoryName, false, "outside-root");
      return [];
    }
    try {
      const stat = lstatSync(confined);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        return [];
      }
      return readdirSync(confined);
    } catch {
      return [];
    }
  }

  realpath(fileName: string): string {
    const confined = this.confine(fileName);
    return confined ?? fileName;
  }

  getCurrentDirectory(): string {
    return this.root;
  }
}
