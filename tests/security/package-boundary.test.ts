import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

function readPkg(rel: string): { dependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8")) as {
    dependencies?: Record<string, string>;
  };
}

describe("module ownership", () => {
  it("keeps contracts free of React, Fastify, fs, and TypeScript", () => {
    const deps = Object.keys(readPkg("packages/contracts/package.json").dependencies ?? {});
    expect(deps).toEqual([]);
  });

  it("does not let packages depend on application code", () => {
    for (const rel of [
      "packages/contracts/package.json",
      "packages/graph/package.json",
      "packages/parser-ts/package.json",
      "packages/engine/package.json",
    ]) {
      const deps = Object.keys(readPkg(rel).dependencies ?? {});
      expect(deps.some((name) => name.startsWith("@reposcope/cli"))).toBe(false);
      expect(deps.some((name) => name.startsWith("@reposcope/server"))).toBe(false);
      expect(deps.some((name) => name.startsWith("@reposcope/web"))).toBe(false);
    }
  });
});
