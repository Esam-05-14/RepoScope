import {
  buildInvestigationBrief,
  formatInvestigationBrief,
  type BriefDensity,
  type InvestigationBrief,
  type ViewLens,
} from "@reposcope/contracts";
import type { AnalysisSnapshot } from "@reposcope/contracts";
import { cycleGroupsFromSnapshot } from "./analyze.js";
import { relationsFromSnapshot } from "./relations.js";

export function briefFromSnapshot(
  snapshot: AnalysisSnapshot,
  density: BriefDensity = "compact",
  lens: ViewLens = "investigation",
): {
  brief: InvestigationBrief;
  markdown: string;
} {
  const relations = relationsFromSnapshot(snapshot);
  const brief = buildInvestigationBrief(
    snapshot,
    cycleGroupsFromSnapshot(snapshot).map((group) => [...group.members]),
    {
      components: relations.components,
      componentEdges: relations.componentEdges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        fileEdges: edge.fileEdges,
      })),
      boundaryFiles: relations.boundaryFiles,
      barrels: relations.barrels,
    },
  );
  return { brief, markdown: formatInvestigationBrief(brief, { density, lens }) };
}

export function downloadText(filename: string, body: string, type: string): void {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
