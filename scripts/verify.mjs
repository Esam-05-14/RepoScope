import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "build"]],
  ["npm", ["test"]],
  ["npx", ["playwright", "test"]],
];

for (const [cmd, args] of steps) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const bench = spawnSync(process.execPath, ["scripts/benchmark.mjs", "1000"], {
  stdio: "inherit",
});
if (bench.status !== 0) {
  process.stderr.write("benchmark failed; verify continues without treating it as a product gate\n");
}
