import type { AnalysisSnapshot, LanguageId, ParseStatus } from "./snapshot.js";

export const BRIEF_CLAIMS = [
  "Observed file-level dependencies only. A -> B means A imports B.",
  "Not runtime execution, not symbol usage, not a break forecast.",
  "Potential investigation scope is reverse reachability onto a file.",
  "Unresolved means not resolved under this configuration.",
  "Type-only imports are omitted from the default value graph.",
  "This brief lists repository paths. Keep it on this machine unless you intend to share that structure.",
  "Pasting into a cloud assistant leaves this machine. RepoScope does not call a model.",
  "A component is a directory or workspace package prefix. Rolled-up edges are observed file imports, not runtime module boundaries.",
] as const;

export interface BriefComponent {
  id: string;
  kind: string;
  files: number;
  imports: number;
  importedBy: number;
}

export interface BriefComponentEdge {
  from: string;
  to: string;
  fileEdges: number;
}

export type BriefDensity = "compact" | "full";

export interface BriefFormatOptions {
  density?: BriefDensity;
}

export interface FileDegree {
  id: string;
  language: LanguageId;
  parseStatus: ParseStatus;
  imports: number;
  importedBy: number;
}

export interface ExternalPackageUse {
  name: string;
  importers: string[];
}

export interface BriefOmission {
  importer: string;
  specifier: string;
  reason: string;
}

export interface InvestigationBrief {
  schemaVersion: string;
  engineVersion: string;
  parserVersion: string;
  graphDigest: string;
  contentManifestDigest: string;
  scope: {
    kind: string;
    edgePolicy: string;
    selectedCommit?: string;
    files: number;
    internalEdges: number;
    truncated: boolean;
  };
  claims: readonly string[];
  files: FileDegree[];
  hubs: FileDegree[];
  entrypoints: string[];
  leaves: string[];
  isolated: string[];
  adjacency: { from: string; to: string[] }[];
  reverse: { to: string; from: string[] }[];
  cycles: string[][];
  externals: ExternalPackageUse[];
  unresolved: BriefOmission[];
  unsupported: BriefOmission[];
  contexts: { id: string; kind: string; configPath: string | null }[];
  declaredPackages: string[];
  components: BriefComponent[];
  componentEdges: BriefComponentEdge[];
  boundaryFiles: string[];
  barrels: string[];
  estimatedChars: number;
}

function includedByPolicy(edgeClass: string, policy: string): boolean {
  if (policy === "include-type-only") {
    return true;
  }
  return edgeClass === "value" || edgeClass === "mixed";
}

export function buildInvestigationBrief(
  snapshot: AnalysisSnapshot,
  cycles: readonly (readonly string[])[],
  extras: {
    components?: BriefComponent[];
    componentEdges?: BriefComponentEdge[];
    boundaryFiles?: string[];
    barrels?: string[];
  } = {},
): InvestigationBrief {
  const policy = snapshot.scope.edgePolicy;
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();
  for (const node of snapshot.nodes) {
    imports.set(node.id, new Set());
    importedBy.set(node.id, new Set());
  }
  let internalEdges = 0;
  for (const edge of snapshot.semanticEdges) {
    if (edge.targetId === undefined || !includedByPolicy(edge.edgeClass, policy)) {
      continue;
    }
    internalEdges += 1;
    imports.get(edge.importerId)?.add(edge.targetId);
    importedBy.get(edge.targetId)?.add(edge.importerId);
  }

  const files: FileDegree[] = snapshot.nodes.map((node) => ({
    id: node.id,
    language: node.language,
    parseStatus: node.parseStatus,
    imports: imports.get(node.id)?.size ?? 0,
    importedBy: importedBy.get(node.id)?.size ?? 0,
  }));

  const hubs = [...files]
    .sort((left, right) => right.importedBy - left.importedBy || left.id.localeCompare(right.id))
    .filter((file) => file.importedBy > 0)
    .slice(0, 25);

  const entrypoints = files
    .filter((file) => file.imports > 0 && file.importedBy === 0)
    .map((file) => file.id)
    .sort();
  const leaves = files
    .filter((file) => file.importedBy > 0 && file.imports === 0)
    .map((file) => file.id)
    .sort();
  const isolated = files
    .filter((file) => file.imports === 0 && file.importedBy === 0)
    .map((file) => file.id)
    .sort();

  const adjacency = [...imports.entries()]
    .filter(([, tos]) => tos.size > 0)
    .map(([from, tos]) => ({ from, to: [...tos].sort() }))
    .sort((left, right) => left.from.localeCompare(right.from));
  const reverse = [...importedBy.entries()]
    .filter(([, froms]) => froms.size > 0)
    .map(([to, froms]) => ({ to, from: [...froms].sort() }))
    .sort((left, right) => left.to.localeCompare(right.to));

  const externalsMap = new Map<string, Set<string>>();
  const unresolved: BriefOmission[] = [];
  const unsupported: BriefOmission[] = [];
  for (const observation of snapshot.observations) {
    if (observation.resolution.status === "external" && observation.resolution.externalName !== undefined) {
      const set = externalsMap.get(observation.resolution.externalName) ?? new Set<string>();
      set.add(observation.importerId);
      externalsMap.set(observation.resolution.externalName, set);
    }
    if (observation.resolution.status === "unresolved") {
      unresolved.push({
        importer: observation.importerId,
        specifier: observation.specifier,
        reason: observation.resolution.reasonCode,
      });
    }
    if (observation.resolution.status === "unsupported") {
      unsupported.push({
        importer: observation.importerId,
        specifier: observation.specifier,
        reason: observation.syntaxKind,
      });
    }
  }

  const brief: InvestigationBrief = {
    schemaVersion: snapshot.schemaVersion,
    engineVersion: snapshot.engineVersion,
    parserVersion: snapshot.parserVersion,
    graphDigest: snapshot.graphDigest,
    contentManifestDigest: snapshot.contentManifestDigest,
    scope: {
      kind: snapshot.scope.kind,
      edgePolicy: snapshot.scope.edgePolicy,
      selectedCommit: snapshot.scope.selectedCommit,
      files: snapshot.nodes.length,
      internalEdges,
      truncated: snapshot.scope.truncated === true,
    },
    claims: BRIEF_CLAIMS,
    files,
    hubs,
    entrypoints,
    leaves,
    isolated,
    adjacency,
    reverse,
    cycles: cycles.map((group) => [...group]),
    externals: [...externalsMap.entries()]
      .map(([name, importers]) => ({ name, importers: [...importers].sort() }))
      .sort((left, right) => right.importers.length - left.importers.length || left.name.localeCompare(right.name)),
    unresolved,
    unsupported,
    contexts: (snapshot.projectContexts ?? []).map((context) => ({
      id: context.id,
      kind: context.kind,
      configPath: context.configPath,
    })),
    declaredPackages: snapshot.coverage.declaredPackages ?? [],
    components: extras.components ?? [],
    componentEdges: extras.componentEdges ?? [],
    boundaryFiles: extras.boundaryFiles ?? [],
    barrels: extras.barrels ?? [],
    estimatedChars: 0,
  };
  brief.estimatedChars = formatInvestigationBrief(brief, { density: "compact" }).length;
  return brief;
}

function take(values: readonly string[], limit: number): string[] {
  return values.length <= limit ? [...values] : [...values.slice(0, limit), `… +${values.length - limit}`];
}

export function formatInvestigationBrief(
  brief: InvestigationBrief,
  options: BriefFormatOptions = {},
): string {
  const compact = options.density !== "full";
  const adjLimit = compact ? 40 : brief.adjacency.length;
  const reverseLimit = compact ? 25 : brief.reverse.length;
  const hubIds = new Set(brief.hubs.map((hub) => hub.id));
  const adjacency = compact
    ? [...brief.adjacency]
        .sort((left, right) => right.to.length - left.to.length || left.from.localeCompare(right.from))
        .slice(0, adjLimit)
    : brief.adjacency;
  const reverse = compact
    ? brief.reverse.filter((row) => hubIds.has(row.to)).slice(0, reverseLimit)
    : brief.reverse;
  const lines: string[] = [
    compact ? "RepoScope investigation brief (compact)" : "RepoScope investigation brief (full)",
    `v ${brief.schemaVersion} ${brief.engineVersion} ${brief.parserVersion}`,
    `digest ${brief.graphDigest}`,
    `scope ${brief.scope.kind} policy=${brief.scope.edgePolicy} files=${brief.scope.files} edges=${brief.scope.internalEdges}${brief.scope.truncated ? " truncated" : ""}`,
    "",
    "claims",
    ...brief.claims.map((claim) => `- ${claim}`),
    "",
    "hubs (most imported-by)",
    ...brief.hubs.map((hub) => `${hub.id} in=${hub.importedBy} out=${hub.imports} ${hub.language} ${hub.parseStatus}`),
    "",
    "entrypoints (import others, not imported)",
    take(brief.entrypoints, compact ? 20 : 200).join("\n") || "(none)",
    "",
    "leaves (imported, import none)",
    take(brief.leaves, compact ? 20 : 200).join("\n") || "(none)",
    "",
    compact
      ? `adjacency A>B,C (top ${adjacency.length} by fan-out; use full for every file)`
      : "adjacency A>B,C (A imports B and C)",
    ...adjacency.map((row) => `${row.from}>${row.to.join(",")}`),
    "",
    compact ? "reverse B<A,C (hubs only)" : "reverse B<A,C (imported by)",
    ...reverse.map((row) => `${row.to}<${row.from.join(",")}`),
    "",
    "cycles",
    brief.cycles.length === 0
      ? "(none)"
      : brief.cycles.map((group) => group.join(" -> ")).join("\n"),
    "",
    "components (directory or workspace package prefix)",
    brief.components.length === 0
      ? "(none)"
      : brief.components
          .slice(0, compact ? 20 : 80)
          .map((item) => `${item.id} files=${item.files} out=${item.imports} in=${item.importedBy} ${item.kind}`)
          .join("\n"),
    "",
    "component edges A>B n (observed file imports rolled up)",
    brief.componentEdges.length === 0
      ? "(none)"
      : brief.componentEdges
          .slice(0, compact ? 25 : 120)
          .map((item) => `${item.from}>${item.to} ${item.fileEdges}`)
          .join("\n"),
    "",
    "component-boundary files",
    take(brief.boundaryFiles, compact ? 20 : 80).join("\n") || "(none)",
    "",
    "barrel files (internal edges are export-from only)",
    take(brief.barrels, compact ? 15 : 40).join("\n") || "(none)",
    "",
    "declared package.json names (not installed, not resolved as internals)",
    brief.declaredPackages.length === 0
      ? "(none)"
      : take(brief.declaredPackages, compact ? 40 : 512).join("\n"),
    "",
    "observed externals",
    brief.externals.length === 0
      ? "(none)"
      : brief.externals
          .slice(0, compact ? 20 : 80)
          .map((item) => `${item.name} <- ${item.importers.join(",")}`)
          .join("\n"),
    "",
    "unresolved",
    brief.unresolved.length === 0
      ? "(none)"
      : brief.unresolved
          .slice(0, compact ? 20 : 80)
          .map((item) => `${item.importer} ${item.specifier} ${item.reason}`)
          .join("\n"),
    "",
    "unsupported",
    brief.unsupported.length === 0
      ? "(none)"
      : brief.unsupported
          .slice(0, compact ? 15 : 40)
          .map((item) => `${item.importer} ${item.specifier} ${item.reason}`)
          .join("\n"),
    "",
    "contexts",
    brief.contexts.map((context) => `${context.id} ${context.kind} ${context.configPath ?? "-"}`).join("\n") ||
      "(none)",
  ];
  return `${lines.join("\n")}\n`;
}
