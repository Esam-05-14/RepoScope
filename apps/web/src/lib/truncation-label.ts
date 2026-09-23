const LABELS: Record<string, string> = {
  "max-directory-depth": "Directory walk stopped at the depth limit.",
  "max-directory-entries": "Directory walk stopped at the entry limit.",
  "max-source-files": "Scan stopped at the source-file limit. Later files were not analyzed.",
  "max-analyzed-bytes": "Scan stopped at the analyzed-byte limit.",
  "manifest-too-large": "A manifest was larger than the read cap and was skipped.",
  "max-bytes-per-file": "A source file was larger than the per-file cap and was skipped.",
  "symlink-skipped": "A symlink was not followed.",
  "source-root-outside": "A declared source root left the selected directory and was not used.",
  "config-outside-root": "A declared config path left the selected directory and was not used.",
  "xml-doctype-skipped": "A Maven file with a doctype or entity declaration was skipped.",
  "xml-rejected": "A Maven file was rejected by the XML reader and was not used as a module.",
  "max-observations":
    "Import observations in a file were capped. Later declarations in that file were omitted.",
  "notebook-rejected": "A notebook was not valid JSON and its code cells were not read.",
};

export function truncationLabel(code: string): string {
  const colon = code.indexOf(":");
  const key = colon === -1 ? code : code.slice(0, colon);
  const detail = colon === -1 ? "" : code.slice(colon + 1);
  const sentence = LABELS[key] ?? "A scan limit was recorded.";
  return detail.length > 0 ? `${sentence} ${detail}` : sentence;
}

export function graphWindowCopy(
  shownFiles: number,
  totalFiles: number,
  relations: number,
  fileCap: number,
  relationCap: number,
): string {
  return `Showing ${shownFiles} of ${totalFiles} files in this view (${relations} relations). The cap is ${fileCap} files and ${relationCap} relations. The file list still contains the rest.`;
}
