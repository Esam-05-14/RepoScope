import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfinedFilesystemHost, scanRepository } from "@reposcope/engine";

describe("out-of-root reads", () => {
  it("does not read a file outside the selected root through the host", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "reposcope-r2-"));
    const root = path.join(parent, "project");
    const outside = path.join(parent, "secret.ts");
    mkdirSync(root);
    writeFileSync(path.join(root, "inside.ts"), "export const ok = 1;\n");
    writeFileSync(outside, "export const secret = 1;\n");

    const host = new ConfinedFilesystemHost(root);
    expect(host.readFile(outside)).toBeUndefined();
    expect(host.fileExists(outside)).toBe(false);
    expect(host.deniedReads.some((entry) => path.resolve(entry) === path.resolve(outside))).toBe(
      true,
    );
    expect(host.attempts.some((attempt) => attempt.allowed && attempt.path === outside)).toBe(
      false,
    );
  });

  it("classifies a relative escape as outside the root without creating an internal edge", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "reposcope-r2-esc-"));
    const root = path.join(parent, "project");
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(parent, "outside.ts"), "export const leak = 1;\n");
    writeFileSync(
      path.join(root, "src", "index.ts"),
      "import { leak } from '../../outside.js';\nexport const x = leak;\n",
    );
    writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
        },
        include: ["src/**/*.ts"],
      }),
    );

    const snapshot = scanRepository({ root });
    const observation = snapshot.observations[0];
    expect(observation?.specifier).toBe("../../outside.js");
    expect(observation?.resolution.status).not.toBe("internal");
    expect(observation?.resolution.reasonCode).toBe("OUTSIDE_ROOT");
    expect(snapshot.semanticEdges.every((edge) => edge.targetId !== "outside.ts")).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("secret");
  });
});
