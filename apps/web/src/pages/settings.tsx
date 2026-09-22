import { useState, type ReactElement } from "react";
import { clearAnalysis, clearCloneCache } from "../lib/api.js";
import { navigate } from "../lib/router.js";
import { useWorkspace } from "../workspace.js";

export function SettingsPage(): ReactElement {
  const workspace = useWorkspace();
  const [cleared, setCleared] = useState<string>();
  const limits = workspace.snapshot?.scope.limits;
  return (
    <main className="page">
      <h1>Settings</h1>
      <p>
        Limits are session-local. Source-free snapshots persist under the application cache
        (~/.reposcope/store or REPOSCOPE_CACHE), capped at 20 per repository identity. GitHub clones
        live under ~/.reposcope/clones and are pruned to the eight most recent. Clearing analysis or
        clone cache does not write to the inspected repository.
      </p>
      {limits !== undefined ? (
        <ul>
          <li>Max source files: {limits.maxSourceFiles}</li>
          <li>Max bytes per file: {limits.maxBytesPerFile}</li>
          <li>Max analyzed bytes: {limits.maxAnalyzedBytes}</li>
          <li>Edge policy: {workspace.snapshot?.scope.edgePolicy}</li>
        </ul>
      ) : (
        <p>Limits appear after a scan.</p>
      )}
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            void clearAnalysis().then(() => {
              workspace.reset();
              window.dispatchEvent(new Event("reposcope:scanned"));
              setCleared("analysis");
              navigate("/");
            });
          }}
        >
          Clear local analysis data
        </button>
        <button
          type="button"
          onClick={() => {
            void clearCloneCache().then((result) => {
              setCleared(`cache:${result.removed}`);
            });
          }}
        >
          Clear GitHub clone cache
        </button>
      </div>
      {cleared === "analysis" ? <p>Cleared analysis data.</p> : null}
      {cleared?.startsWith("cache:") === true ? (
        <p>Removed {cleared.slice("cache:".length)} cached clones.</p>
      ) : null}
    </main>
  );
}
