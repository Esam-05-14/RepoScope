import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "build"]],
  ["npm", ["test"]],
];

for (const [cmd, args] of steps) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
