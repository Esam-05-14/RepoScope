import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface InspectLock {
  pid: number;
  port: number;
  token: string;
}

function lockDir(): string {
  if (process.env.REPOSCOPE_CACHE !== undefined && process.env.REPOSCOPE_CACHE !== "") {
    return process.env.REPOSCOPE_CACHE;
  }
  return path.join(os.homedir(), ".reposcope");
}

export function inspectLockPath(port: number): string {
  return path.join(lockDir(), `inspect-${port}.lock.json`);
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readInspectLock(port: number): InspectLock | undefined {
  const dest = inspectLockPath(port);
  if (!existsSync(dest)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(dest, "utf8")) as Partial<InspectLock>;
    if (
      typeof parsed.pid !== "number" ||
      typeof parsed.port !== "number" ||
      typeof parsed.token !== "string" ||
      parsed.token.length < 32
    ) {
      return undefined;
    }
    return { pid: parsed.pid, port: parsed.port, token: parsed.token };
  } catch {
    return undefined;
  }
}

export function writeInspectLock(lock: InspectLock): void {
  const dest = inspectLockPath(lock.port);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, `${JSON.stringify({ pid: lock.pid, port: lock.port, token: lock.token })}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function clearInspectLock(port: number): void {
  const dest = inspectLockPath(port);
  if (existsSync(dest)) {
    rmSync(dest, { force: true });
  }
}

export function livingInspectLock(port: number): InspectLock | undefined {
  const lock = readInspectLock(port);
  if (lock === undefined) {
    return undefined;
  }
  if (!processAlive(lock.pid)) {
    clearInspectLock(port);
    return undefined;
  }
  return lock;
}
