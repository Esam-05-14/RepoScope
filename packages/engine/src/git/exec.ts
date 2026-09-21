import { execFileSync } from "node:child_process";

export class GitAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitAdapterError";
  }
}

export function assertSafeGitRev(value: string): string {
  if (value.startsWith("-") || value.includes("..") || value.includes("\0")) {
    throw new GitAdapterError("unsupported git revision");
  }
  if (!/^[0-9a-f]{7,64}$/i.test(value) && !/^[A-Za-z0-9._/-]{1,256}$/.test(value)) {
    throw new GitAdapterError("unsupported git revision");
  }
  return value;
}

export function gitExec(repo: string, args: readonly string[]): Buffer {
  try {
    return execFileSync("git", ["-C", repo, ...args], {
      encoding: "buffer",
      timeout: 30_000,
      maxBuffer: 50 * 1024 * 1024,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const err = error as { stderr?: Buffer; message?: string };
    const detail = err.stderr?.toString("utf8").trim() || err.message || "git command failed";
    throw new GitAdapterError(detail.slice(0, 200));
  }
}

export function resolveCommit(repo: string, rev: string): string {
  const safe = assertSafeGitRev(rev);
  const stdout = gitExec(repo, ["rev-parse", "--verify", `${safe}^{commit}`]);
  return stdout.toString("utf8").trim();
}
