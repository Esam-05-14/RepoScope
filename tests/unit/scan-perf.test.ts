import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanRepository } from "@reposcope/engine";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("scan performance bookkeeping", () => {
  it("records elapsed time and hits the resolver cache on duplicate specifiers", () => {
    const snapshot = scanRepository({
      root: path.join(workspace, "fixtures", "duplicate-imports"),
    });
    expect(snapshot.coverage.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.coverage.resolverCacheHits).toBeGreaterThan(0);
    expect(snapshot.engineVersion).toBe("0.11.0");
  });

  it("keeps an identical digest when the same tree is scanned twice", () => {
    const root = path.join(workspace, "fixtures", "esm-baseline");
    const first = scanRepository({ root });
    const second = scanRepository({ root });
    expect(second.graphDigest).toBe(first.graphDigest);
    expect(second.contentManifestDigest).toBe(first.contentManifestDigest);
  });
});
