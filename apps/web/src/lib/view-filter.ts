import {
  externalKind,
  fileRole,
  libraryNodeId,
  type AnalysisSnapshot,
  type ViewLens,
} from "@reposcope/contracts";
import { includedByPolicy } from "@reposcope/graph";

export interface ViewFilterOptions {
  lens: ViewLens;
  includeTests: boolean;
  hideIsolated: boolean;
}

export interface LibraryDisplayNode {
  id: string;
  name: string;
  kind: "library" | "builtin";
  importers: string[];
}

export function visibleFileIds(
  snapshot: AnalysisSnapshot,
  options: ViewFilterOptions,
): string[] {
  let ids = snapshot.nodes.map((node) => node.id);
  if (options.lens === "investigation") {
    ids = ids.filter((id) => {
      const role = fileRole(id);
      if (role === "config") {
        return false;
      }
      if (role === "test" && !options.includeTests) {
        return false;
      }
      return true;
    });
  } else if (!options.includeTests) {
    ids = ids.filter((id) => fileRole(id) !== "test");
  }
  if (!options.hideIsolated) {
    return ids.sort();
  }
  const kept = new Set(ids);
  const connected = new Set<string>();
  for (const edge of snapshot.semanticEdges) {
    if (
      edge.targetId === undefined ||
      !includedByPolicy(edge.edgeClass, snapshot.scope.edgePolicy) ||
      !kept.has(edge.importerId) ||
      !kept.has(edge.targetId)
    ) {
      continue;
    }
    connected.add(edge.importerId);
    connected.add(edge.targetId);
  }
  return ids.filter((id) => connected.has(id)).sort();
}

export function restrictSnapshot(
  snapshot: AnalysisSnapshot,
  fileIds: readonly string[],
): AnalysisSnapshot {
  const kept = new Set(fileIds);
  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => kept.has(node.id)),
    semanticEdges: snapshot.semanticEdges.filter(
      (edge) =>
        kept.has(edge.importerId) && edge.targetId !== undefined && kept.has(edge.targetId),
    ),
  };
}

export function libraryDisplayNodes(
  snapshot: AnalysisSnapshot,
  visibleFiles: ReadonlySet<string>,
  includeBuiltins: boolean,
): LibraryDisplayNode[] {
  const map = new Map<string, Set<string>>();
  const kinds = new Map<string, "library" | "builtin">();
  for (const observation of snapshot.observations) {
    if (observation.resolution.status !== "external" || observation.resolution.externalName === undefined) {
      continue;
    }
    if (!visibleFiles.has(observation.importerId)) {
      continue;
    }
    const name = observation.resolution.externalName;
    const kind = externalKind(name);
    if (kind === "builtin" && !includeBuiltins) {
      continue;
    }
    const set = map.get(name) ?? new Set<string>();
    set.add(observation.importerId);
    map.set(name, set);
    kinds.set(name, kind);
  }
  return [...map.entries()]
    .map(([name, importers]) => ({
      id: libraryNodeId(name),
      name,
      kind: kinds.get(name) ?? "library",
      importers: [...importers].sort(),
    }))
    .sort((left, right) => right.importers.length - left.importers.length || left.name.localeCompare(right.name));
}
