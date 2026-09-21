import { useState, type ReactElement } from "react";
import { clearAnalysis } from "../lib/api.js";
import { useWorkspace } from "../workspace.js";

export function SettingsPage(): ReactElement {
  const { snapshot } = useWorkspace();
  const [cleared, setCleared] = useState(false);
  const limits = snapshot?.scope.limits;
  return (
    <main className="page">
      <h1>Settings</h1>
      <p>Limits are session-local. Clearing analysis data does not write to the inspected repository.</p>
      {limits !== undefined ? (
        <ul>
          <li>Max source files: {limits.maxSourceFiles}</li>
          <li>Max bytes per file: {limits.maxBytesPerFile}</li>
          <li>Max analyzed bytes: {limits.maxAnalyzedBytes}</li>
        </ul>
      ) : (
        <p>Limits appear after a scan.</p>
      )}
      <button
        type="button"
        onClick={() => {
          void clearAnalysis().then(() => {
            setCleared(true);
            window.location.assign("/");
          });
        }}
      >
        Clear local analysis data
      </button>
      {cleared ? <p>Cleared.</p> : null}
    </main>
  );
}
