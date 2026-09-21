import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { GitObjectFilesystemHost, scanRepository } from "@reposcope/engine";

function git(repo: string, args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function hashFile(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

describe("git object isolation", () => {
  it("reads the commit object store and does not mutate a dirty worktree", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "reposcope-git-"));
    git(repo, ["init"]);
    mkdirSync(path.join(repo, "src"), { recursive: true });
    writeFileSync(
      path.join(repo, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          paths: { "@lib/*": ["./src/*"] },
        },
        include: ["src/**/*.ts"],
      }),
    );
    writeFileSync(path.join(repo, "src", "money.ts"), "export const cents = 1;\n");
    writeFileSync(
      path.join(repo, "src", "main.ts"),
      "import { cents } from '@lib/money.ts';\nexport const v = cents;\n",
    );
    git(repo, ["add", "."]);
    execFileSync(
      "git",
      ["-C", repo, "-c", "user.name=RepoScope", "-c", "user.email=dev@local", "commit", "-m", "seed"],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    const commit = git(repo, ["rev-parse", "HEAD"]).trim();
    writeFileSync(path.join(repo, "src", "money.ts"), "export const cents = 99;\n");
    writeFileSync(path.join(repo, "src", "extra.ts"), "export const dirty = true;\n");
    const before = hashFile(path.join(repo, "src", "money.ts"));

    const host = GitObjectFilesystemHost.open(repo, commit);
    const first = scanRepository({
      root: repo,
      host,
      scopeKind: "git-commit",
      selectedCommit: host.commit,
    });
    const second = scanRepository({
      root: repo,
      host: GitObjectFilesystemHost.open(repo, commit),
      scopeKind: "git-commit",
      selectedCommit: commit,
    });

    expect(hashFile(path.join(repo, "src", "money.ts"))).toBe(before);
    expect(first.nodes.map((node) => node.id).sort()).toEqual(["src/main.ts", "src/money.ts"]);
    expect(first.nodes.map((node) => node.id)).not.toContain("src/extra.ts");
    const money = first.nodes.find((node) => node.id === "src/money.ts");
    const dirtyHash = `sha256:${before}`;
    expect(money?.contentHash).not.toBe(dirtyHash);
    expect(first.observations.some((item) => item.resolution.targetId === "src/money.ts")).toBe(
      true,
    );
    expect(second.graphDigest).toBe(first.graphDigest);
    expect(first.scope.kind).toBe("git-commit");
  });
});
