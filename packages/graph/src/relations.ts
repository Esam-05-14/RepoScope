import { includedByPolicy, type EdgeClass, type EdgePolicy } from "./adjacency.js";

export interface WorkspacePackageRef {
  name: string;
  directory: string;
}

export interface RelationFile {
  id: string;
}

export interface RelationEdge {
  importerId: string;
  targetId?: string;
  edgeClass: EdgeClass;
  syntaxClass?: string;
}

export interface RelationObservation {
  importerId: string;
  syntaxKind: string;
  status: string;
  targetId?: string;
}

export interface ComponentNode {
  id: string;
  kind: "workspace-package" | "directory";
  files: number;
  imports: number;
  importedBy: number;
}

export interface ComponentEdge {
  from: string;
  to: string;
  fileEdges: number;
  examples: { importerId: string; targetId: string }[];
}

export interface ComponentRelationGraph {
  components: ComponentNode[];
  componentEdges: ComponentEdge[];
  boundaryFiles: string[];
  barrels: string[];
  fileComponent: Record<string, string>;
}

export interface FileRelationView {
  fileId: string;
  componentId: string;
  barrel: boolean;
  boundary: boolean;
  crossComponentImports: { fileId: string; componentId: string }[];
  crossComponentImportedBy: { fileId: string; componentId: string }[];
  coImported: { fileId: string; sharedImporters: string[] }[];
  neighborhood: string[];
}

const WORKSPACE_ROOTS = new Set(["packages", "apps", "libs", "modules"]);

export function componentIdForFile(
  fileId: string,
  packages: readonly WorkspacePackageRef[] = [],
): string {
  const normalized = fileId.replaceAll("\\", "/");
  const nested = [...packages]
    .filter((item) => item.directory !== "." && item.directory !== "")
    .sort((left, right) => right.directory.length - left.directory.length)
    .find((item) => {
      const dir = item.directory.replace(/\/$/, "");
      return normalized === dir || normalized.startsWith(`${dir}/`);
    });
  if (nested !== undefined) {
    return `pkg:${nested.name}`;
  }
  const parts = normalized.split("/").filter((part) => part.length > 0);
  const dirParts = parts.slice(0, -1);
  if (dirParts.length === 0) {
    return ".";
  }
  const root = dirParts[0] ?? "";
  if (WORKSPACE_ROOTS.has(root) && dirParts.length >= 2) {
    return `${root}/${dirParts[1]}`;
  }
  return dirParts.slice(0, 2).join("/");
}

export function neighborhoodOf(
  origin: string,
  edges: readonly RelationEdge[],
  hops: number,
  policy: EdgePolicy,
): Set<string> {
  const kept = new Set<string>([origin]);
  if (hops <= 0) {
    return kept;
  }
  const undirected = new Map<string, Set<string>>();
  const add = (from: string, to: string): void => {
    const left = undirected.get(from) ?? new Set<string>();
    left.add(to);
    undirected.set(from, left);
  };
  for (const edge of edges) {
    if (edge.targetId === undefined || !includedByPolicy(edge.edgeClass, policy)) {
      continue;
    }
    add(edge.importerId, edge.targetId);
    add(edge.targetId, edge.importerId);
  }
  let frontier = [origin];
  for (let depth = 0; depth < hops; depth += 1) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const neighbor of undirected.get(current) ?? []) {
        if (kept.has(neighbor)) {
          continue;
        }
        kept.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return kept;
}

function isExportFromKind(syntaxKind: string): boolean {
  return (
    syntaxKind === "export-from" ||
    syntaxKind === "type-only-export-from" ||
    syntaxKind === "mixed-export-from"
  );
}

export function buildComponentRelations(input: {
  files: readonly RelationFile[];
  edges: readonly RelationEdge[];
  observations?: readonly RelationObservation[];
  policy: EdgePolicy;
  workspacePackages?: readonly WorkspacePackageRef[];
}): ComponentRelationGraph {
  const packages = input.workspacePackages ?? [];
  const fileComponent: Record<string, string> = {};
  const filesByComponent = new Map<string, string[]>();
  for (const file of input.files) {
    const component = componentIdForFile(file.id, packages);
    fileComponent[file.id] = component;
    const list = filesByComponent.get(component) ?? [];
    list.push(file.id);
    filesByComponent.set(component, list);
  }

  const out = new Map<string, Set<string>>();
  const inn = new Map<string, Set<string>>();
  const pair = new Map<string, ComponentEdge>();
  for (const id of filesByComponent.keys()) {
    out.set(id, new Set());
    inn.set(id, new Set());
  }

  const neighbors = new Map<string, Set<string>>();
  for (const file of input.files) {
    neighbors.set(file.id, new Set());
  }

  for (const edge of input.edges) {
    if (edge.targetId === undefined || !includedByPolicy(edge.edgeClass, input.policy)) {
      continue;
    }
    neighbors.get(edge.importerId)?.add(edge.targetId);
    neighbors.get(edge.targetId)?.add(edge.importerId);
    const from = fileComponent[edge.importerId];
    const to = fileComponent[edge.targetId];
    if (from === undefined || to === undefined || from === to) {
      continue;
    }
    out.get(from)?.add(to);
    inn.get(to)?.add(from);
    const key = `${from}>${to}`;
    const existing = pair.get(key);
    if (existing !== undefined) {
      existing.fileEdges += 1;
      if (existing.examples.length < 8) {
        existing.examples.push({ importerId: edge.importerId, targetId: edge.targetId });
      }
      continue;
    }
    pair.set(key, {
      from,
      to,
      fileEdges: 1,
      examples: [{ importerId: edge.importerId, targetId: edge.targetId }],
    });
  }

  const kindOf = (id: string): ComponentNode["kind"] =>
    id.startsWith("pkg:") ? "workspace-package" : "directory";

  const components = [...filesByComponent.entries()]
    .map(([id, files]) => ({
      id,
      kind: kindOf(id),
      files: files.length,
      imports: out.get(id)?.size ?? 0,
      importedBy: inn.get(id)?.size ?? 0,
    }))
    .sort((left, right) => right.files - left.files || left.id.localeCompare(right.id));

  const componentEdges = [...pair.values()].sort(
    (left, right) => right.fileEdges - left.fileEdges || left.from.localeCompare(right.from),
  );

  const boundaryFiles = input.files
    .map((file) => file.id)
    .filter((id) => {
      const own = fileComponent[id];
      for (const neighbor of neighbors.get(id) ?? []) {
        const other = fileComponent[neighbor];
        if (other !== undefined && other !== own) {
          return true;
        }
      }
      return false;
    })
    .sort();

  const internals = new Map<string, string[]>();
  for (const observation of input.observations ?? []) {
    if (observation.status !== "internal" || observation.targetId === undefined) {
      continue;
    }
    const list = internals.get(observation.importerId) ?? [];
    list.push(observation.syntaxKind);
    internals.set(observation.importerId, list);
  }
  const barrels = [...internals.entries()]
    .filter(([, kinds]) => kinds.length > 0 && kinds.every((kind) => isExportFromKind(kind)))
    .map(([id]) => id)
    .sort();

  return {
    components,
    componentEdges,
    boundaryFiles,
    barrels,
    fileComponent,
  };
}

export function fileRelationView(input: {
  fileId: string;
  files: readonly RelationFile[];
  edges: readonly RelationEdge[];
  observations?: readonly RelationObservation[];
  policy: EdgePolicy;
  workspacePackages?: readonly WorkspacePackageRef[];
}): FileRelationView | undefined {
  if (!input.files.some((file) => file.id === input.fileId)) {
    return undefined;
  }
  const relations = buildComponentRelations(input);
  const componentId = relations.fileComponent[input.fileId] ?? componentIdForFile(input.fileId);
  const reverse = new Map<string, string[]>();
  const forward = new Map<string, string[]>();
  for (const edge of input.edges) {
    if (edge.targetId === undefined || !includedByPolicy(edge.edgeClass, input.policy)) {
      continue;
    }
    const outs = forward.get(edge.importerId) ?? [];
    outs.push(edge.targetId);
    forward.set(edge.importerId, outs);
    const ins = reverse.get(edge.targetId) ?? [];
    ins.push(edge.importerId);
    reverse.set(edge.targetId, ins);
  }

  const crossComponentImports = (forward.get(input.fileId) ?? [])
    .map((fileId) => ({ fileId, componentId: relations.fileComponent[fileId] ?? componentIdForFile(fileId) }))
    .filter((item) => item.componentId !== componentId)
    .sort((left, right) => left.fileId.localeCompare(right.fileId));
  const crossComponentImportedBy = (reverse.get(input.fileId) ?? [])
    .map((fileId) => ({ fileId, componentId: relations.fileComponent[fileId] ?? componentIdForFile(fileId) }))
    .filter((item) => item.componentId !== componentId)
    .sort((left, right) => left.fileId.localeCompare(right.fileId));

  const coImportedMap = new Map<string, Set<string>>();
  for (const importer of reverse.get(input.fileId) ?? []) {
    for (const other of forward.get(importer) ?? []) {
      if (other === input.fileId) {
        continue;
      }
      const shared = coImportedMap.get(other) ?? new Set<string>();
      shared.add(importer);
      coImportedMap.set(other, shared);
    }
  }
  const coImported = [...coImportedMap.entries()]
    .map(([fileId, importers]) => ({ fileId, sharedImporters: [...importers].sort() }))
    .sort((left, right) => right.sharedImporters.length - left.sharedImporters.length || left.fileId.localeCompare(right.fileId))
    .slice(0, 12);

  return {
    fileId: input.fileId,
    componentId,
    barrel: relations.barrels.includes(input.fileId),
    boundary: relations.boundaryFiles.includes(input.fileId),
    crossComponentImports,
    crossComponentImportedBy,
    coImported,
    neighborhood: [...neighborhoodOf(input.fileId, input.edges, 2, input.policy)].sort(),
  };
}
