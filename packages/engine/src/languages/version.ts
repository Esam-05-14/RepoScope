import { PARSER_VERSION, type LanguageId } from "@reposcope/contracts";
import { JAVA_PARSER_VERSION } from "@reposcope/parser-java";
import { KT_PARSER_VERSION } from "@reposcope/parser-kt";
import { PY_PARSER_VERSION } from "@reposcope/parser-py";

export function isForeignLanguage(language: LanguageId): language is "py" | "java" | "kt" {
  return language === "py" || language === "java" || language === "kt";
}

export function emittedParserVersion(hasForeign: boolean): string {
  if (!hasForeign) {
    return PARSER_VERSION;
  }
  return `${PARSER_VERSION}+${PY_PARSER_VERSION}+${JAVA_PARSER_VERSION}+${KT_PARSER_VERSION}`;
}
