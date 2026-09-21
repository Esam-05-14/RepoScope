export type { FilesystemHost } from "./host.js";
export {
  compilerApiVersion,
  hasCreateSourceFile,
  hasResolveModuleName,
} from "./api.js";
export { languageFromPath, scriptKindFor, SOURCE_EXTENSIONS } from "./language.js";
export { parseSourceFile, parseDiagnostics } from "./parse.js";
export { extractConstructs, type ExtractedConstruct } from "./extract.js";
export {
  parseProjectConfig,
  inferredCompilerOptions,
  type ParsedProjectConfig,
} from "./config.js";
export { resolveSpecifier, isRelativeSpecifier } from "./resolve.js";
