export interface FilesystemHost {
  fileExists(path: string): boolean;
  readFile(path: string): string | undefined;
  directoryExists?(path: string): boolean;
  readDirectory?(path: string): string[];
  realpath?(path: string): string;
  getCurrentDirectory?(): string;
}
