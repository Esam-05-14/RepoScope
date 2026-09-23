export const JAVA_PARSER_VERSION = "java-import@2";

export { extractJavaImports, type DeclaredImport } from "./extract.js";
export { readPom, type PomInfo } from "./maven.js";
export { extractGradleIncludes, extractGradleSourceDirs } from "./gradle.js";
