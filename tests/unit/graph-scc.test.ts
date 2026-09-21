import { describe, expect, it } from "vitest";
import {
  buildAdjacency,
  stronglyConnectedComponents,
  type DirectedEdge,
} from "@reposcope/graph";

function sccs(nodeIds: string[], pairs: [string, string][]) {
  const edges: DirectedEdge[] = pairs.map(([from, to]) => ({
    from,
    to,
    edgeClass: "value",
  }));
  const { forward } = buildAdjacency(nodeIds, edges);
  return stronglyConnectedComponents(forward);
}

describe("cycle groups", () => {
  it("does not treat a chain as cyclic", () => {
    expect(
      sccs(["a", "b", "c"], [
        ["a", "b"],
        ["b", "c"],
      ]),
    ).toEqual([]);
  });

  it("detects a self-loop", () => {
    const groups = sccs(["loop"], [["loop", "loop"]]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members).toEqual(["loop"]);
    expect(groups[0]?.witnessPath).toEqual(["loop", "loop"]);
  });

  it("detects a three-node cycle and returns a witness path", () => {
    const groups = sccs(["a", "b", "c"], [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members).toEqual(["a", "b", "c"]);
    const witness = groups[0]?.witnessPath ?? [];
    expect(witness[0]).toBe(witness[witness.length - 1]);
    expect(witness.length).toBeGreaterThan(3);
  });

  it("computes SCCs iteratively on a long chain", () => {
    const nodeIds = Array.from({ length: 400 }, (_, index) => `n${index}`);
    const pairs: [string, string][] = [];
    for (let index = 0; index < 399; index += 1) {
      pairs.push([`n${index}`, `n${index + 1}`]);
    }
    expect(sccs(nodeIds, pairs)).toEqual([]);
  });
});
