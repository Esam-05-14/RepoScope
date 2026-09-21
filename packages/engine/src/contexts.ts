import { createHash } from "node:crypto";
import path from "node:path";
import type { ProjectContext } from "@reposcope/contracts";
import {
  inferredCompilerOptions,
  parseProjectConfig,
  type ParsedProjectConfig,
} from "@reposcope/parser-ts";
import type { ConfinedFilesystemHost } from "./filesystem/confined-fs.js";
import { toPosixRelative } from "./filesystem/paths.js";

export interface BoundContext {
  record: ProjectContext;
  options: ParsedProjectConfig["options"];
}

function configKind(fileName: string): "tsconfig" | "jsconfig" {
  return path.basename(fileName) === "jsconfig.json" ? "jsconfig" : "tsconfig";
}

function extendsOutside(
  host: ConfinedFilesystemHost,
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
  host: ConfinedFilesystemHost,
  configFiles: readonly string[],
): BoundContext[] {
  const loaded: BoundContext[] = [];
  for (const configPath of configFiles) {
    if (extendsOutside(host, configPath)) {
      continue;
    }
    const parsed = parseProjectConfig(configPath, host);
    if (parsed.extendsOutsideRoot) {
      continue;
    }
    const relative = toPosixRelative(host.root, configPath);
    const bytes = host.readFileBytes(configPath);
    loaded.push({
      record: {
        id: `ctx:${relative}`,
        kind: configKind(configPath),
        configPath: relative,
        digest:
          bytes === undefined
            ? undefined
            : `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      },
      options: parsed.options,
    });
  }
  return loaded;
}

export function inferredContext(): BoundContext {
  return {
    record: {
      id: "ctx:inferred",
      kind: "inferred",
      configPath: null,
    },
    options: inferredCompilerOptions(),
  };
}

export function selectContext(
  fileAbsolute: string,
  root: string,
  contexts: readonly BoundContext[],
  inferred: BoundContext,
): BoundContext {
  let directory = path.dirname(fileAbsolute);
  for (;;) {
    const match = contexts.find((context) => {
      if (context.record.configPath === null) {
        return false;
      }
      const configDir = path.dirname(path.resolve(root, context.record.configPath));
      return path.resolve(configDir) === path.resolve(directory);
    });
    if (match !== undefined) {
      return match;
    }
    if (directory === root || path.dirname(directory) === directory) {
      return inferred;
    }
    directory = path.dirname(directory);
  }
}
