import type { AnalysisSnapshot } from "@reposcope/contracts";

export interface BoundaryRule {
  id: string;
  from: string;
  to: string;
}

export interface BoundaryPolicy {
  schemaVersion: string;
  groups: Record<string, string[]>;
  forbid: BoundaryRule[];
}

export interface BoundaryViolation {
  ruleId: string;
  observationId: string;
  importerId: string;
  targetId: string;
  fromGroup: string;
  toGroup: string;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replaceAll("**", ":::GLOBSTAR:::").replaceAll("*", "[^/]*").replaceAll(":::GLOBSTAR:::", ".*");
  return new RegExp(`^${pattern}$`);
}

function matches(globs: readonly string[], relativePath: string): boolean {
  return globs.some((glob) => globToRegExp(glob).test(relativePath));
}

export function groupsForPath(
  policy: BoundaryPolicy,
  relativePath: string,
): string[] {
  return Object.entries(policy.groups)
    .filter(([, globs]) => matches(globs, relativePath))
    .map(([name]) => name)
    .sort();
}

export function evaluateBoundaryPolicy(
  snapshot: AnalysisSnapshot,
  policy: BoundaryPolicy,
): BoundaryViolation[] {
  const observationById = new Map(
    snapshot.observations.map((observation) => [observation.id, observation]),
  );
  const violations: BoundaryViolation[] = [];
  for (const rule of policy.forbid) {
    const fromGlobs = policy.groups[rule.from];
    const toGlobs = policy.groups[rule.to];
    if (fromGlobs === undefined || toGlobs === undefined) {
      continue;
    }
    for (const edge of snapshot.semanticEdges) {
      if (edge.targetId === undefined) {
        continue;
      }
      if (!matches(fromGlobs, edge.importerId) || !matches(toGlobs, edge.targetId)) {
        continue;
      }
      const observationId = edge.observationIds[0];
      if (observationId === undefined) {
        continue;
      }
      const observation = observationById.get(observationId);
      if (observation === undefined) {
        continue;
      }
      violations.push({
        ruleId: rule.id,
        observationId,
        importerId: edge.importerId,
        targetId: edge.targetId,
        fromGroup: rule.from,
        toGroup: rule.to,
      });
    }
  }
  violations.sort((a, b) =>
    `${a.ruleId}:${a.observationId}`.localeCompare(`${b.ruleId}:${b.observationId}`),
  );
  return violations;
}
