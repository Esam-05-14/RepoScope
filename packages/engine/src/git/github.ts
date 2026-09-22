import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GitAdapterError, assertSafeGitRev } from "./exec.js";

const execFileAsync = promisify(execFile);
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const SHORTHAND = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;

export interface GitHubRepoRef {
  owner: string;
  name: string;
  ref?: string;
  httpsUrl: string;
  label: string;
}

export interface ClonedGitHubRepo {
  root: string;
  label: string;
  spec: GitHubRepoRef;
}

export function defaultGitHubCacheRoot(): string {
  return process.env.REPOSCOPE_CACHE ?? path.join(os.homedir(), ".reposcope", "clones");
}

export function looksLikeGitHubInput(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.toLowerCase().includes("github.com/")) {
    return true;
  }
  if (trimmed.startsWith("github:")) {
    return true;
  }
  return SHORTHAND.test(trimmed);
}

export function parseGitHubRepoInput(input: string): GitHubRepoRef {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed.includes("\0") || trimmed.includes("\\")) {
    throw new GitAdapterError("not a github.com repository locator");
  }
  if (trimmed.startsWith("github:")) {
    return fromOwnerRepo(trimmed.slice("github:".length), undefined);
  }
  if (SHORTHAND.test(trimmed) && !trimmed.includes("://")) {
    return fromOwnerRepo(trimmed, undefined);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new GitAdapterError("not a github.com repository locator");
  }
  if (parsed.protocol !== "https:") {
    throw new GitAdapterError("only https://github.com locators are accepted");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new GitAdapterError("repository locators must not include credentials");
  }
  if (parsed.port !== "" && parsed.port !== "443") {
    throw new GitAdapterError("only https://github.com locators are accepted");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    throw new GitAdapterError("only https://github.com locators are accepted");
  }
  const parts = parsed.pathname.split("/").filter((part) => part !== "");
  if (parts[0] === undefined || parts[1] === undefined) {
    throw new GitAdapterError("not a github.com repository locator");
  }
  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  let ref: string | undefined;
  if (parts[2] === "tree" || parts[2] === "commit") {
    const rest = parts.slice(3).join("/");
    if (rest !== "") {
      ref = rest;
    }
  } else if (parts[2] !== undefined && parts[2] !== "blob") {
    throw new GitAdapterError("not a github.com repository locator");
  }
  return fromOwnerRepo(`${owner}/${name}`, ref);
}

function fromOwnerRepo(ownerRepo: string, ref: string | undefined): GitHubRepoRef {
  const [owner, name] = ownerRepo.split("/");
  if (owner === undefined || name === undefined || !NAME.test(owner) || !NAME.test(name)) {
    throw new GitAdapterError("not a github.com repository locator");
  }
  if (owner === "." || owner === ".." || name === "." || name === "..") {
    throw new GitAdapterError("not a github.com repository locator");
  }
  if (ref !== undefined) {
    assertSafeGitRev(ref);
  }
  return {
    owner,
    name,
    ref,
    httpsUrl: `https://github.com/${owner}/${name}.git`,
    label: `github.com/${owner}/${name}`,
  };
}

export async function cloneGitHubRepository(input: {
  spec: GitHubRepoRef;
  ref?: string;
  cacheRoot?: string;
}): Promise<ClonedGitHubRepo> {
  const spec = input.spec;
  const ref = input.ref ?? spec.ref;
  if (ref !== undefined) {
    assertSafeGitRev(ref);
  }
  const cacheRoot = path.resolve(input.cacheRoot ?? defaultGitHubCacheRoot());
  mkdirSync(cacheRoot, { recursive: true });
  const hooks = path.join(cacheRoot, "_empty_hooks");
  mkdirSync(hooks, { recursive: true });
  const key = createHash("sha256").update(spec.httpsUrl).digest("hex").slice(0, 16);
  const dest = path.join(cacheRoot, `${spec.owner}--${spec.name}--${key}`);
  if (existsSync(dest) && lstatSync(dest).isSymbolicLink()) {
    throw new GitAdapterError("clone destination must not be a symlink");
  }
  if (!existsSync(dest)) {
    const cloneArgs = [
      "-c",
      `core.hooksPath=${hooks}`,
      "-c",
      "filter.lfs.smudge=",
      "-c",
      "filter.lfs.process=",
      "-c",
      "protocol.file.allow=never",
      "clone",
      "--depth",
      "1",
      "--single-branch",
      "--no-recurse-submodules",
    ];
    if (ref !== undefined && !/^[0-9a-f]{7,64}$/i.test(ref)) {
      cloneArgs.push("--branch", ref);
    }
    cloneArgs.push(spec.httpsUrl, dest);
    await git(undefined, cloneArgs);
  } else {
    await git(dest, ["-c", `core.hooksPath=${hooks}`, "fetch", "--depth", "1", "origin"]);
  }
  const canonical = realpathSync.native(dest);
  const cacheReal = realpathSync.native(cacheRoot);
  if (canonical !== cacheReal && !canonical.startsWith(cacheReal + path.sep)) {
    throw new GitAdapterError("clone escaped the application cache");
  }
  if (ref !== undefined) {
    await git(canonical, [
      "-c",
      `core.hooksPath=${hooks}`,
      "fetch",
      "--depth",
      "1",
      "origin",
      assertSafeGitRev(ref),
    ]);
    await git(canonical, ["-c", `core.hooksPath=${hooks}`, "checkout", "--detach", "FETCH_HEAD"]);
  }
  pruneGitHubCache(cacheRoot, 8);
  return { root: canonical, label: spec.label, spec };
}

function confineCachePath(root: string, candidate: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    return null;
  }
  return resolved;
}

function cloneDirectoryEntries(cacheRoot: string): { dest: string; mtimeMs: number }[] {
  if (!existsSync(cacheRoot)) {
    return [];
  }
  const entries: { dest: string; mtimeMs: number }[] = [];
  for (const name of readdirSync(cacheRoot)) {
    if (name === "_empty_hooks" || name.includes("..") || name.includes("/") || name.includes("\\")) {
      continue;
    }
    const dest = confineCachePath(cacheRoot, path.join(cacheRoot, name));
    if (dest === null) {
      continue;
    }
    try {
      const stat = lstatSync(dest);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        continue;
      }
      entries.push({ dest, mtimeMs: stat.mtimeMs });
    } catch {
      continue;
    }
  }
  return entries;
}

export function pruneGitHubCache(cacheRoot = defaultGitHubCacheRoot(), keep = 8): number {
  const root = path.resolve(cacheRoot);
  const entries = cloneDirectoryEntries(root).sort((a, b) => b.mtimeMs - a.mtimeMs);
  let removed = 0;
  for (const extra of entries.slice(keep)) {
    rmSync(extra.dest, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

export function clearGitHubCache(cacheRoot = defaultGitHubCacheRoot()): number {
  const root = path.resolve(cacheRoot);
  let removed = 0;
  for (const entry of cloneDirectoryEntries(root)) {
    rmSync(entry.dest, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

async function git(repo: string | undefined, args: readonly string[]): Promise<string> {
  const argv = repo === undefined ? [...args] : ["-C", repo, ...args];
  try {
    const result = await execFileAsync("git", argv, {
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
    });
    return result.stdout;
  } catch (error) {
    const err = error as { stderr?: string | Buffer; message?: string };
    const detail =
      (typeof err.stderr === "string" ? err.stderr : err.stderr?.toString("utf8"))?.trim() ||
      err.message ||
      "git clone failed";
    throw new GitAdapterError(detail.slice(0, 200));
  }
}
