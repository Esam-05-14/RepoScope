import { useMemo, useState, type ReactElement } from "react";
import type { BriefDensity } from "@reposcope/contracts";
import { COPY } from "../lib/copy.js";
import { briefFromSnapshot, copyText, downloadText } from "../lib/brief.js";
import { useWorkspace } from "../workspace.js";

export function BriefPage(): ReactElement {
  const { snapshot, snapshotId } = useWorkspace();
  const [copied, setCopied] = useState(false);
  const [density, setDensity] = useState<BriefDensity>("compact");
  const packed = useMemo(
    () => (snapshot === undefined ? undefined : briefFromSnapshot(snapshot, density)),
    [snapshot, density],
  );

  if (snapshot === undefined || packed === undefined) {
    return (
      <main className="page">
        <h1>Investigation brief</h1>
        <p>Scan a repository first.</p>
      </main>
    );
  }

  const id = snapshotId?.slice(0, 12) ?? "snapshot";

  return (
    <main className="page page-wide" data-testid="brief-page">
      <h1>Investigation brief</h1>
      <p>{COPY.brief}</p>
      <p className="muted">{COPY.briefPrivacy}</p>
      <p className="muted">
        About {packed.markdown.length} characters · {packed.brief.scope.files} files ·{" "}
        {packed.brief.scope.internalEdges} observed edges · {density}
      </p>
      <div className="actions">
        <button
          type="button"
          aria-pressed={density === "compact"}
          onClick={() => {
            setDensity("compact");
          }}
        >
          Compact
        </button>
        <button
          type="button"
          aria-pressed={density === "full"}
          onClick={() => {
            setDensity("full");
          }}
        >
          Full adjacency
        </button>
        <button
          type="button"
          data-testid="copy-brief"
          onClick={() => {
            void copyText(packed.markdown).then(() => {
              setCopied(true);
            });
          }}
        >
          Copy brief
        </button>
        <button
          type="button"
          onClick={() => {
            downloadText(`reposcope-${id}-brief.md`, packed.markdown, "text/markdown");
          }}
        >
          Download markdown
        </button>
        <button
          type="button"
          onClick={() => {
            downloadText(
              `reposcope-${id}-brief.json`,
              `${JSON.stringify(packed.brief, null, 2)}\n`,
              "application/json",
            );
          }}
        >
          Download JSON
        </button>
      </div>
      {copied ? <p role="status">Copied. {COPY.briefPrivacy}</p> : null}
      <pre className="brief-pre" data-testid="brief-markdown">
        {packed.markdown}
      </pre>
    </main>
  );
}
