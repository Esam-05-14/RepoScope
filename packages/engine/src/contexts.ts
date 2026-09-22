import { createHash } from "node:crypto";
import path from "node:path";
import type { ProjectContext } from "@reposcope/contracts";
import {
  inferredCompilerOptions,
  parseProjectConfig,
  type ParsedProjectConfig,
} from "@reposcope/parser-ts";
import type { AnalysisFilesystemHost } from "./filesystem/host.js";
import { toPosixRelative } from "./filesystem/paths.js";

export interface BoundContext {
  record: ProjectContext;
  options: ParsedProjectConfig["options"];
  fileNames: string[];
}

function configKind(fileName: string): "tsconfig" | "jsconfig" {
  return path.basename(fileName) === "jsconfig.json" ? "jsconfig" : "tsconfig";
}

function extendsOutside(
  host: AnalysisFilesystemHost,
  configPath: string,
): boolean {
  const text = host.readFile(configPath);
  if (text === undefined) {
    return false;
  }
  const match = /"extends"\s*:\s*"([^"]+)"/.exec(text);
  if (match?.[1] === undefined) {
    return false;
  }
  const reference = match[1];
  if (!reference.startsWith(".") && !reference.includes("/") && !reference.includes("\\")) {
    return false;
  }
  const candidate = path.resolve(path.dirname(configPath), reference);
  return host.confine(candidate) === null;
}

export function loadProjectContexts(
  host: AnalysisFilesystemHost,
  configFiles: readonly string[],
): BoundContext[] {
  const loaded: BoundContext[] = [];
  const seen = new Set<string>();
  const queue = [...configFiles];
  while (queue.length > 0) {
    const configPath = queue.shift();
    if (configPath === undefined) {
      break;
    }
    const key = path.resolve(configPath);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (host.confine(configPath) === null) {
      continue;
    }
    if (extendsOutside(host, configPath)) {
      continue;
    }
    const configBytes = host.readFileBytes(configPath);
    if (configBytes !== undefined && configBytes.byteLength > 256 * 1024) {
      continue;
    }
    if (loaded.length >= 64) {
      break;
    }
    const parsed = parseProjectConfig(configPath, host);
    if (parsed.extendsOutsideRoot) {
      continue;
    }
    const relative = toPosixRelative(host.root, configPath);
    const bytes = configBytes ?? host.readFileBytes(configPath);
    const pathMappings = pathMappingsFromOptions(parsed.options);
    loaded.push({
      record: {
        id: `ctx:${relative}`,
        kind: configKind(configPath),
        configPath: relative,
        digest:
          bytes === undefined
            ? undefined
            : `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        pathMappings,
      },
      options: parsed.options,
      fileNames: parsed.fileNames,
    });
    for (const reference of parsed.references) {
      if (host.confine(reference) !== null) {
        queue.push(reference);
      }
    }
  }
  return loaded;
}

function pathMappingsFromOptions(options: { paths?: Record<string, string[] | undefined> }): string[] | undefined {
  if (options.paths === undefined) {
    return undefined;
  }
  const rows: string[] = [];
  for (const [alias, targets] of Object.entries(options.paths)) {
    const dest = (targets ?? [])
      .map((target) => target.replaceAll("\\", "/"))
      .filter((target) => !/^[A-Za-z]:/.test(target) && !target.startsWith("/"))
      .join(", ");
    if (dest !== "") {
      rows.push(`${alias} -> ${dest}`);
    }
  }
  return rows.length === 0 ? undefined : rows.slice(0, 32);
}

export function inferredContext(): BoundContext {
  return {
    record: {
      id: "ctx:inferred",
      kind: "inferred",
      configPath: null,
    },
    options: inferredCompilerOptions(),
    fileNames: [],
  };
}

export function createContextSelector(
  root: string,
  contexts: readonly BoundContext[],
  inferred: BoundContext,
): (fileAbsolute: string) => BoundContext {
  const byFile = new Map<string, BoundContext>();
  for (const context of contexts) {
    const specificity = context.record.configPath?.length ?? 0;
    for (const fileName of context.fileNames) {
      const resolved = path.resolve(fileName);
      const existing = byFile.get(resolved);
      if (existing === undefined || specificity > (existing.record.configPath?.length ?? 0)) {
        byFile.set(resolved, context);
      }
    }
  }
  const byDir = new Map<string, BoundContext>();
  for (const context of contexts) {
    if (context.record.configPath === null) {
      continue;
    }
    const configDir = path.resolve(root, path.dirname(context.record.configPath));
    const existing = byDir.get(configDir);
    if (existing === undefined || (context.record.configPath.length > (existing.record.configPath?.length ?? 0))) {
      byDir.set(configDir, context);
    }
  }
  const resolvedRoot = path.resolve(root);
  return (fileAbsolute: string): BoundContext => {
    const resolved = path.resolve(fileAbsolute);
    const listed = byFile.get(resolved);
    if (listed !== undefined) {
      return listed;
    }
    let directory = path.dirname(resolved);
    for (;;) {
      const match = byDir.get(directory);
      if (match !== undefined) {
        return match;
      }
      if (directory === resolvedRoot) {
        return inferred;
      }
      const parent = path.dirname(directory);
      if (parent === directory) {
        return inferred;
      }
      directory = parent;
    }
  };
}

export function selectContext(
  fileAbsolute: string,
  root: string,
  contexts: readonly BoundContext[],
  inferred: BoundContext,
): BoundContext {
  return createContextSelector(root, contexts, inferred)(fileAbsolute);
}
