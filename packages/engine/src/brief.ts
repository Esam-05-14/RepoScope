import {
  buildInvestigationBrief,
  formatInvestigationBrief,
  type BriefDensity,
  type InvestigationBrief,
  type ViewLens,
} from "@reposcope/contracts";
import type { AnalysisSnapshot } from "@reposcope/contracts";
import { cycleGroupsFromSnapshot, relationsFromSnapshot } from "./analyze.js";

function briefExtras(snapshot: AnalysisSnapshot) {
  const relations = relationsFromSnapshot(snapshot);
  return {
    components: relations.components,
    componentEdges: relations.componentEdges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      fileEdges: edge.fileEdges,
    })),
    boundaryFiles: relations.boundaryFiles,
    barrels: relations.barrels,
  };
}

export function investigationBriefFromSnapshot(snapshot: AnalysisSnapshot): {
  brief: InvestigationBrief;
  markdown: string;
} {
  const brief = buildInvestigationBrief(
    snapshot,
    cycleGroupsFromSnapshot(snapshot).map((group) => group.members),
    briefExtras(snapshot),
  );
  return { brief, markdown: formatInvestigationBrief(brief, { density: "compact" }) };
}

export function investigationBriefMarkdown(
  snapshot: AnalysisSnapshot,
  density: BriefDensity = "compact",
  lens: ViewLens = "investigation",
): { brief: InvestigationBrief; markdown: string } {
  const { brief } = investigationBriefFromSnapshot(snapshot);
  return { brief, markdown: formatInvestigationBrief(brief, { density, lens }) };
}
