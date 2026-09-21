import type { FilesystemHost } from "@reposcope/parser-ts";

export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

export interface ReadAttempt {
  path: string;
  allowed: boolean;
  reason?: "outside-root" | "symlink" | "missing" | "not-a-file";
}

export interface AnalysisFilesystemHost extends FilesystemHost {
  readonly root: string;
  readonly attempts: ReadAttempt[];
  readonly deniedReads: string[];
  confine(candidate: string): string | null;
  readFileBytes(fileName: string): Buffer | undefined;
  stat(fileName: string): FileStat | undefined;
  directoryExists(directoryName: string): boolean;
  readDirectory(directoryName: string): string[];
}
