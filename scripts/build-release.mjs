import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = path.join(root, "release");
const pack = path.join(release, "npm");

rmSync(release, { recursive: true, force: true });
mkdirSync(pack, { recursive: true });

await build({
  entryPoints: [path.join(root, "apps/cli/src/main.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(pack, "main.cjs"),
  legalComments: "none",
  logLevel: "info",
});

cpSync(path.join(root, "apps/web/dist"), path.join(pack, "web"), { recursive: true });
cpSync(path.join(root, "fixtures"), path.join(pack, "fixtures"), { recursive: true });
writeFileSync(
  path.join(pack, "package.json"),
  JSON.stringify(
    {
      name: "reposcope",
      version: "0.11.0",
      description: "Local, read-only TypeScript, JavaScript, Python, Java, and Kotlin architecture explorer",
      license: "MIT",
      type: "commonjs",
      bin: { reposcope: "main.cjs" },
      files: ["main.cjs", "web", "fixtures"],
      engines: { node: ">=24.21.0 <25" },
    },
    null,
    2,
  ),
);
cpSync(path.join(root, "README.md"), path.join(pack, "README.md"));
cpSync(path.join(root, "LICENSE"), path.join(pack, "LICENSE"));

const seaConfig = {
  main: path.join(pack, "main.cjs"),
  output: path.join(release, "sea-prep.blob"),
  disableExperimentalSEAWarning: true,
};
writeFileSync(path.join(release, "sea-config.json"), JSON.stringify(seaConfig));
const sea = spawnSync(process.execPath, ["--experimental-sea-config", path.join(release, "sea-config.json")], {
  cwd: root,
  stdio: "inherit",
});
if (sea.status !== 0) {
  process.exit(sea.status ?? 1);
}

const exe = path.join(release, "reposcope.exe");
copyFileSync(process.execPath, exe);
const injected = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/postject/dist/cli.js"),
    exe,
    "NODE_SEA_BLOB",
    path.join(release, "sea-prep.blob"),
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    "--overwrite",
  ],
  { cwd: root, stdio: "inherit" },
);
if (injected.status !== 0) {
  process.exit(injected.status ?? 1);
}
cpSync(path.join(pack, "web"), path.join(release, "web"), { recursive: true });
cpSync(path.join(pack, "fixtures"), path.join(release, "fixtures"), { recursive: true });
process.stdout.write(`release ${exe}\n`);
