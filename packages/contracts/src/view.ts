export type ViewLens = "investigation" | "libraries";
export type FileRole = "source" | "test" | "config";
export type ExternalKind = "library" | "builtin";

export const LIBRARY_NODE_PREFIX = "lib:";

const TEST_PATH =
  /(?:^|\/)(?:__tests__|__mocks__|tests|test|spec|e2e)(?:\/|$)/i;
const TEST_FILE = /\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/i;
const PYTHON_TEST = /(?:^|\/)(?:test_.+\.py|.+_test\.py|conftest\.py)$/i;
const CONFIG_FILE =
  /(?:^|\/)(?:vite|vitest|playwright|webpack|rollup|eslint|prettier|babel|jest|karma|cypress|tailwind|postcss|next|nuxt|astro|remix|svelte\.config|drizzle)(?:\.config)?\.[cm]?[jt]sx?$/i;
const ENV_DTS = /\.d\.ts$/i;

export function isViewLens(value: string | undefined): value is ViewLens {
  return value === "investigation" || value === "libraries";
}

export function fileRole(fileId: string): FileRole {
  const normalized = fileId.replaceAll("\\", "/");
  const base = normalized.split("/").pop() ?? normalized;
  if (TEST_PATH.test(normalized) || TEST_FILE.test(base) || PYTHON_TEST.test(normalized)) {
    return "test";
  }
  if (CONFIG_FILE.test(base) || (ENV_DTS.test(base) && !normalized.includes("/"))) {
    return "config";
  }
  if (base.endsWith(".d.ts") && (base.includes("vite-env") || base.includes("env.d"))) {
    return "config";
  }
  return "source";
}

export type SourceFamily = "typescript" | "python" | "java" | "kotlin";

export function languageFamily(language: string): SourceFamily {
  if (language === "py") {
    return "python";
  }
  if (language === "java") {
    return "java";
  }
  if (language === "kt") {
    return "kotlin";
  }
  return "typescript";
}

export function externalKind(name: string): ExternalKind {
  return name.startsWith("node:") || name.startsWith("bun:") ? "builtin" : "library";
}

export function libraryNodeId(name: string): string {
  return `${LIBRARY_NODE_PREFIX}${name}`;
}

export function parseLibraryNodeId(id: string): string | undefined {
  if (!id.startsWith(LIBRARY_NODE_PREFIX)) {
    return undefined;
  }
  const name = id.slice(LIBRARY_NODE_PREFIX.length);
  return name.length > 0 ? name : undefined;
}
