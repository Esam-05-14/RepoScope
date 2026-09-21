import { describe, expect, it } from "vitest";
import { buildAdjacency, type DirectedEdge } from "@reposcope/graph";

const nodes = ["a", "b", "c", "d"];

function edges(...pairs: [string, string, DirectedEdge["edgeClass"]?][]): DirectedEdge[] {
  return pairs.map(([from, to, edgeClass]) => ({
    from,
    to,
    edgeClass: edgeClass ?? "value",
  }));
}

describe("adjacency", () => {
  it("stores A -> B when A declares a dependency on B", () => {
    const { forward, reverse } = buildAdjacency(nodes, edges(["a", "b"]));
    expect(forward.get("a")).toEqual(["b"]);
    expect(reverse.get("b")).toEqual(["a"]);
  });

  it("deduplicates the same semantic relation", () => {
    const { forward } = buildAdjacency(nodes, edges(["a", "b"], ["a", "b"]));
    expect(forward.get("a")).toEqual(["b"]);
  });

  it("keeps a diamond as four directed edges", () => {
    const { forward, reverse } = buildAdjacency(
      nodes,
      edges(["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]),
    );
    expect(forward.get("a")).toEqual(["b", "c"]);
    expect(reverse.get("d")).toEqual(["b", "c"]);
  });

  it("keeps disconnected nodes with empty adjacency", () => {
    const { forward, reverse } = buildAdjacency(["lonely"], []);
    expect(forward.get("lonely")).toEqual([]);
    expect(reverse.get("lonely")).toEqual([]);
  });

  it("omits type-only edges under the default policy", () => {
    const { forward } = buildAdjacency(
      nodes,
      edges(["a", "b", "type"], ["a", "c", "value"]),
    );
    expect(forward.get("a")).toEqual(["c"]);
  });

  it("includes type-only edges when requested", () => {
    const { forward } = buildAdjacency(
      nodes,
      edges(["a", "b", "type"]),
      "include-type-only",
    );
    expect(forward.get("a")).toEqual(["b"]);
  });
});
