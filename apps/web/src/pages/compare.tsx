import { useState, type ReactElement } from "react";
import type { SnapshotComparison } from "@reposcope/contracts";
import {
  compareSnapshotsApi,
  fetchSnapshot,
  importSnapshotApi,
} from "../lib/api.js";
import { COPY } from "../lib/copy.js";
import { useWorkspace } from "../workspace.js";

export function ComparePage(): ReactElement {
  const workspace = useWorkspace();
  const [baseId, setBaseId] = useState(workspace.snapshotId ?? "");
  const [targetId, setTargetId] = useState("");
  const [comparison, setComparison] = useState<SnapshotComparison>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function runCompare(): Promise<void> {
    setError(undefined);
    try {
      setComparison(await compareSnapshotsApi(baseId, targetId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "compare failed");
    }
  }

  return (
    <main className="page" data-testid="compare-page">
      <h1>Compare snapshots</h1>
      <p>Source-free structural comparison. Identical snapshots produce an empty semantic diff.</p>
      <div className="actions">
        <label>
          Base
          <select
            data-testid="base-snapshot"
            value={baseId}
            onChange={(event) => setBaseId(event.target.value)}
          >
            <option value="">Select</option>
            {workspace.catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target
          <select
            data-testid="target-snapshot"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <option value="">Select</option>
            {workspace.catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || baseId === "" || targetId === ""}
          onClick={() => {
            void runCompare();
          }}
        >
          Compare
        </button>
        <button
          type="button"
          data-testid="load-compare-fixtures"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              setError(undefined);
              try {
                const baselineId = await workspace.runScan(
                  { fixture: "esm-baseline" },
                  "esm-baseline",
                );
                const revisedId = await workspace.runScan(
                  { fixture: "esm-revised" },
                  "esm-revised",
                );
                setBaseId(baselineId);
                setTargetId(revisedId);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "load failed");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Load baseline and revised
        </button>
        <label>
          Import snapshot JSON
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file === undefined) {
                return;
              }
              void file.text().then(async (text) => {
                const imported = await importSnapshotApi(JSON.parse(text) as unknown);
                const snapshot = await fetchSnapshot(imported.id);
                workspace.remember({ id: imported.id, label: file.name }, snapshot, false);
              });
            }}
          />
        </label>
      </div>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {comparison !== undefined ? (
        <section>
          {comparison.compatibility.status === "blocked" ? (
            <p role="alert">
              {COPY.compareBlocked} {comparison.compatibility.reasons.join(", ")}
            </p>
          ) : comparison.compatibility.status === "warning" ? (
            <p className="muted">
              Comparison warning: {comparison.compatibility.reasons.join(", ")}
            </p>
          ) : null}
          {comparison.compatibility.status !== "blocked" &&
          comparison.addedEdges.length === 0 &&
          comparison.removedEdges.length === 0 &&
          comparison.changedNodes.length === 0 ? (
            <p data-testid="empty-diff">Identical semantic inputs produced an empty semantic diff.</p>
          ) : null}
          <h2>Added edges</h2>
          <ul data-testid="added-edges">
            {comparison.addedEdges.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <h2>Removed edges</h2>
          <ul data-testid="removed-edges">
            {comparison.removedEdges.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <h2>Changed files</h2>
          <ul>
            {comparison.changedNodes.map((node) => (
              <li key={node.id}>
                {node.id} ({node.change})
              </li>
            ))}
          </ul>
          <h2>Cycle groups added</h2>
          <ul>
            {comparison.addedCycleGroups.map((group) => (
              <li key={group.join(",")}>{group.join(", ")}</li>
            ))}
          </ul>
          <h2>Cycle groups removed</h2>
          <ul>
            {comparison.removedCycleGroups.map((group) => (
              <li key={group.join(",")}>{group.join(", ")}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
