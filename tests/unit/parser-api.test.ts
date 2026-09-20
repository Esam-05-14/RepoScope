import { describe, expect, it } from "vitest";
import {
  compilerApiVersion,
  hasCreateSourceFile,
  hasResolveModuleName,
} from "@reposcope/parser-ts";

describe("TypeScript 6 compiler API pin", () => {
  it("exposes createSourceFile and resolveModuleName on 6.0.3", () => {
    expect(compilerApiVersion()).toBe("typescript@6.0.3");
    expect(hasCreateSourceFile()).toBe(true);
    expect(hasResolveModuleName()).toBe(true);
  });
});
