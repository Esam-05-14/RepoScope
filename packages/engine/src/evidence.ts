import { createHash } from "node:crypto";
import type { ImportObservation, SourceRange } from "@reposcope/contracts";
import type { AnalysisFilesystemHost } from "./filesystem/host.js";
import { toPosixRelative } from "./filesystem/paths.js";

export const EVIDENCE_SLICE_LIMIT = 16 * 1024;

export type EvidenceFreshness = "current" | "stale" | "unavailable";

export interface EvidenceSlice {
  status: EvidenceFreshness;
  observationId: string;
  importerId: string;
  specifier: string;
  expectedHash: string;
  observedHash?: string;
  snippet?: string;
  range?: SourceRange;
}

export function hashBytes(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function decodeUtf8(bytes: Buffer): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function lineSlice(text: string, range: SourceRange): string {
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, range.startLine - 2);
  const end = Math.min(lines.length, range.endLine + 2);
  const excerpt = lines.slice(start - 1, end).join("\n");
  if (excerpt.length <= EVIDENCE_SLICE_LIMIT) {
    return excerpt;
  }
  return excerpt.slice(0, EVIDENCE_SLICE_LIMIT);
}

export function readEvidence(input: {
  host: AnalysisFilesystemHost;
  importerId: string;
  observation: ImportObservation;
  expectedHash: string;
}): EvidenceSlice {
  const confined = input.host.confine(input.importerId);
  const bytes = confined === null ? undefined : input.host.readFileBytes(confined);
  if (confined === null || bytes === undefined) {
    return {
      status: "unavailable",
      observationId: input.observation.id,
      importerId: input.importerId,
      specifier: input.observation.specifier,
      expectedHash: input.expectedHash,
    };
  }
  const observedHash = hashBytes(bytes);
  if (toPosixRelative(input.host.root, confined) !== input.importerId) {
    return {
      status: "unavailable",
      observationId: input.observation.id,
      importerId: input.importerId,
      specifier: input.observation.specifier,
      expectedHash: input.expectedHash,
      observedHash,
    };
  }
  if (observedHash !== input.expectedHash) {
    return {
      status: "stale",
      observationId: input.observation.id,
      importerId: input.importerId,
      specifier: input.observation.specifier,
      expectedHash: input.expectedHash,
      observedHash,
    };
  }
  const text = decodeUtf8(bytes);
  if (text === undefined) {
    return {
      status: "unavailable",
      observationId: input.observation.id,
      importerId: input.importerId,
      specifier: input.observation.specifier,
      expectedHash: input.expectedHash,
      observedHash,
    };
  }
  return {
    status: "current",
    observationId: input.observation.id,
    importerId: input.importerId,
    specifier: input.observation.specifier,
    expectedHash: input.expectedHash,
    observedHash,
    snippet: lineSlice(text, input.observation.range),
    range: input.observation.range,
  };
}
