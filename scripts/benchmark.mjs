import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanRepository } from "@reposcope/engine";

const count = Number.parseInt(process.argv[2] ?? "1000", 10);
const root = mkdtempSync(path.join(tmpdir(), "reposcope-bench-"));
mkdirSync(path.join(root, "src"), { recursive: true });
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

for (let i = 0; i < count; i += 1) {
  const next = i + 1 < count ? `import './f${i + 1}.js';\n` : "";
  writeFileSync(path.join(root, "src", `f${i}.ts`), `${next}export const n${i} = ${i};\n`);
}

const started = Date.now();
const snapshot = scanRepository({ root });
const elapsedMs = Date.now() - started;
const result = {
  files: snapshot.coverage.analyzedFiles,
  edges: snapshot.semanticEdges.length,
  elapsedMs,
  filesPerSecond: snapshot.coverage.analyzedFiles / Math.max(elapsedMs / 1000, 0.001),
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
