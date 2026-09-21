import { useState, type ReactElement } from "react";
import { fetchDemoFixtures } from "../lib/api.js";
import { navigate } from "../lib/router.js";
import { useWorkspace } from "../workspace.js";

export function HomePage(props: {
  rootKind: string;
  status: string;
}): ReactElement {
  const workspace = useWorkspace();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const snapshot = workspace.snapshot;

  async function scan(body: Record<string, unknown>, label: string): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      await workspace.runScan(body, label);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Overview</h1>
      <p>Local investigation of observed source-level dependencies. No remote analysis.</p>
      <p>
        Root kind: {props.rootKind}. Scan status: {props.status}.
      </p>
      <div className="actions">
        <button
          type="button"
          data-testid="scan-button"
          disabled={busy}
          onClick={() => {
            void scan({}, "working tree");
          }}
        >
          Scan
        </button>
        {props.rootKind === "demo" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void (async () => {
                const demo = await fetchDemoFixtures();
                const revised = demo.fixtures.find((item) => item.id === "esm-revised");
                if (revised !== undefined) {
                  await scan({ fixture: "esm-revised" }, "esm-revised");
                }
              })();
            }}
          >
            Scan revised fixture
          </button>
        ) : null}
        <button type="button" onClick={() => navigate("/explore")}>
          Open explorer
        </button>
      </div>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {snapshot !== undefined ? (
        <section>
          <h2>Coverage snapshot</h2>
          <ul>
            <li>Discovered files: {snapshot.coverage.discoveredFiles}</li>
            <li>Analyzed files: {snapshot.coverage.analyzedFiles}</li>
            <li>Unresolved: {snapshot.coverage.constructCounts.unresolved}</li>
            <li>Unsupported: {snapshot.coverage.constructCounts.unsupported}</li>
          </ul>
        </section>
      ) : (
        <p>No snapshot yet. Scan the CLI-selected root to start.</p>
      )}
    </main>
  );
}
