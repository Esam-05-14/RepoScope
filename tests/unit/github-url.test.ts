import { describe, expect, it } from "vitest";
import { GitAdapterError, looksLikeGitHubInput, parseGitHubRepoInput } from "@reposcope/engine";

describe("GitHub locators", () => {
  it("accepts https github.com URLs, shorthand, and tree refs", () => {
    expect(parseGitHubRepoInput("https://github.com/acme/box")).toMatchObject({
      owner: "acme",
      name: "box",
      httpsUrl: "https://github.com/acme/box.git",
      label: "github.com/acme/box",
    });
    expect(parseGitHubRepoInput("https://www.github.com/acme/box.git/")).toMatchObject({
      owner: "acme",
      name: "box",
    });
    expect(parseGitHubRepoInput("https://github.com/acme/box/tree/main")).toMatchObject({
      ref: "main",
    });
    expect(parseGitHubRepoInput("github:acme/box")).toMatchObject({ owner: "acme", name: "box" });
    expect(parseGitHubRepoInput("acme/box")).toMatchObject({ owner: "acme", name: "box" });
    expect(looksLikeGitHubInput("https://github.com/acme/box")).toBe(true);
  });

  it("rejects credentials, non-https, and non-github hosts", () => {
    const rejected = [
      "http://github.com/acme/box",
      "https://evil.com/acme/box",
      "https://github.com.evil.com/acme/box",
      "https://user:pass@github.com/acme/box",
      "https://github.com/acme/box/issues/1",
      "C:\\repo",
      "../acme/box",
      "git@github.com:acme/box.git",
    ];
    for (const input of rejected) {
      expect(() => parseGitHubRepoInput(input)).toThrow(GitAdapterError);
    }
  });
});
