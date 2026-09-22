export const JAVA_PARSER_VERSION = "java-import@1";

export { extractJavaImports, type DeclaredImport } from "./extract.js";
export { readPom, type PomInfo } from "./maven.js";
export { extractGradleIncludes } from "./gradle.js";
