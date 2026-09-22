import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@reposcope/contracts": path.join(root, "packages/contracts/src/index.ts"),
      "@reposcope/graph": path.join(root, "packages/graph/src/index.ts"),
      "@reposcope/parser-ts": path.join(root, "packages/parser-ts/src/index.ts"),
      "@reposcope/parser-py": path.join(root, "packages/parser-py/src/index.ts"),
      "@reposcope/parser-java": path.join(root, "packages/parser-java/src/index.ts"),
      "@reposcope/parser-kt": path.join(root, "packages/parser-kt/src/index.ts"),
      "@reposcope/engine": path.join(root, "packages/engine/src/index.ts"),
      "@reposcope/server": path.join(root, "apps/server/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "fixtures/**"],
    environment: "node",
    fileParallelism: false,
  },
});
