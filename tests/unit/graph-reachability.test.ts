import { describe, expect, it } from "vitest";
import {
  buildAdjacency,
  paginate,
  reverseImpact,
  shortestObservedPath,
  type DirectedEdge,
} from "@reposcope/graph";

function graph(nodeIds: string[], pairs: [string, string][]) {
  const edges: DirectedEdge[] = pairs.map(([from, to]) => ({
    from,
    to,
    edgeClass: "value",
  }));
  return buildAdjacency(nodeIds, edges);
}

describe("reverse reachability", () => {
  it("returns a chain's direct importer and shortest path", () => {
    const { reverse } = graph(["a", "b", "c"], [
      ["a", "b"],
      ["b", "c"],
    ]);
    const impact = reverseImpact("c", reverse);
    expect(impact.directImporters).toEqual(["b"]);
    expect(impact.transitiveImporters).toEqual(["a"]);
    expect(shortestObservedPath("c", "a", impact.predecessor)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("handles a diamond without enumerating every path", () => {
    const { reverse } = graph(["a", "b", "c", "d"], [
      ["a", "b"],
      ["a", "c"],
      ["b", "d"],
      ["c", "d"],
    ]);
    const impact = reverseImpact("d", reverse);
    expect(impact.directImporters).toEqual(["b", "c"]);
    expect(impact.transitiveImporters).toEqual(["a"]);
    const path = shortestObservedPath("d", "a", impact.predecessor);
    expect(path?.[0]).toBe("a");
    expect(path?.[path.length - 1]).toBe("d");
    expect(path?.length).toBe(3);
  });

  it("excludes the origin from impact even when a cycle returns to it", () => {
    const { reverse } = graph(["a", "b"], [
      ["a", "b"],
      ["b", "a"],
    ]);
    const impact = reverseImpact("a", reverse);
    expect(impact.directImporters).toEqual(["b"]);
    expect(impact.directImporters).not.toContain("a");
    expect(impact.transitiveImporters).not.toContain("a");
  });

  it("reports depth truncation", () => {
    const { reverse } = graph(["a", "b", "c"], [
      ["a", "b"],
      ["b", "c"],
    ]);
    const impact = reverseImpact("c", reverse, { maxDepth: 1 });
    expect(impact.truncated).toBe(true);
    expect(impact.truncationReasons).toContain("max-depth");
    expect(impact.directImporters).toEqual(["b"]);
    expect(impact.transitiveImporters).toEqual([]);
  });

  it("reports node-budget truncation", () => {
    const { reverse } = graph(["a", "b", "c", "d"], [
      ["a", "d"],
      ["b", "d"],
      ["c", "d"],
    ]);
    const impact = reverseImpact("d", reverse, { maxNodes: 2 });
    expect(impact.truncated).toBe(true);
    expect(impact.truncationReasons).toContain("max-nodes");
    expect(impact.directImporters.length + impact.transitiveImporters.length).toBe(1);
  });

  it("paginates long importer lists", () => {
    const page = paginate(["a", "b", "c", "d"], 1, 2);
    expect(page.items).toEqual(["b", "c"]);
    expect(page.total).toBe(4);
    expect(page.truncated).toBe(true);
  });
});
