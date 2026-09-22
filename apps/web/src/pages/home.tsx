import { useMemo, useState, type ReactElement } from "react";
import { downloadSnapshot } from "../lib/api.js";
import { briefFromSnapshot, copyText, downloadText } from "../lib/brief.js";
import { COPY } from "../lib/copy.js";
import { navigate } from "../lib/router.js";
import { statusLabel } from "../status-line.js";
import { useWorkspace } from "../workspace.js";

function rootCaption(rootKind: string): string {
  if (rootKind === "demo") {
    return "bundled fixtures";
  }
  if (rootKind === "github") {
    return "GitHub cache clone";
  }
  return "CLI-selected root";
}

export function HomePage(props: {
  rootKind: string;
  status: string;
}): ReactElement {
  const workspace = useWorkspace();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [github, setGithub] = useState("");
  const [commit, setCommit] = useState("");
  const [incremental, setIncremental] = useState(true);
  const [includeDynamicImport, setIncludeDynamicImport] = useState(false);
  const [copied, setCopied] = useState(false);
  const snapshot = workspace.snapshot;
  const progress = workspace.scanProgress;
  const packed = useMemo(
    () => (snapshot === undefined ? undefined : briefFromSnapshot(snapshot)),
    [snapshot],
  );

  function withScanOptions(body: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = { ...body, incremental, includeDynamicImport };
    const revision = commit.trim();
    if (revision !== "") {
      next.commit = revision;
    }
    return next;
  }

  async function scan(body: Record<string, unknown>, label: string): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      await workspace.runScan(withScanOptions(body), label);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page page-wide">
      <h1>Overview</h1>
      <p>
        Local investigation of observed source-level dependencies. Contributors scan once, read the
        graph, then paste the compact brief into their own assistant instead of asking it to rediscover
        imports. RepoScope does not call a model. {COPY.briefPrivacy} Arrow A → B means A imports B.
      </p>
      <p>
        {statusLabel(props.status)} · {rootCaption(props.rootKind)}
      </p>
      <form
        className="actions"
        onSubmit={(event) => {
          event.preventDefault();
          const locator = github.trim();
          if (locator === "") {
            return;
          }
          void scan({ github: locator }, locator);
        }}
      >
        <label>
          GitHub repository
          <input
            data-testid="github-url"
            value={github}
            onChange={(event) => {
              setGithub(event.target.value);
            }}
            placeholder="https://github.com/owner/repo"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" data-testid="scan-github" disabled={busy || github.trim() === ""}>
          Scan GitHub
        </button>
      </form>
      <div className="actions">
        <label>
          Git commit (optional)
          <input
            data-testid="commit-rev"
            value={commit}
            onChange={(event) => {
              setCommit(event.target.value);
            }}
            placeholder="rev, tag, or branch"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={incremental}
            onChange={(event) => {
              setIncremental(event.target.checked);
            }}
          />
          Reuse unchanged files
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeDynamicImport}
            onChange={(event) => {
              setIncludeDynamicImport(event.target.checked);
            }}
          />
          Include string import()
        </label>
      </div>
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
              void scan({ fixture: "esm-revised" }, "esm-revised");
            }}
          >
            Scan revised fixture
          </button>
        ) : null}
        {props.rootKind === "demo" ? (
          <button
            type="button"
            data-testid="scan-unresolved"
            disabled={busy}
            onClick={() => {
              void scan({ fixture: "unresolved-import" }, "unresolved-import");
            }}
          >
            Scan unresolved-import
          </button>
        ) : null}
        {workspace.activeScanId !== undefined ? (
          <button
            type="button"
            onClick={() => {
              void workspace.cancelActiveScan();
            }}
          >
            Cancel scan
          </button>
        ) : null}
        <button type="button" onClick={() => navigate("/explore")}>
          Open explorer
        </button>
        {workspace.snapshotId !== undefined ? (
          <button
            type="button"
            onClick={() => {
              const id = workspace.snapshotId;
              if (id === undefined) {
                return;
              }
              void downloadSnapshot(id).catch((caught: unknown) => {
                setError(caught instanceof Error ? caught.message : "export failed");
              });
            }}
          >
            Export snapshot
          </button>
        ) : null}
        {packed !== undefined ? (
          <>
            <button type="button" onClick={() => navigate("/brief")}>
              Open brief
            </button>
            <button
              type="button"
              data-testid="copy-brief-home"
              onClick={() => {
                void copyText(packed.markdown).then(() => {
                  setCopied(true);
                });
              }}
            >
              Copy brief
            </button>
          </>
        ) : null}
      </div>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {copied ? <p role="status">Brief copied. {COPY.brief}</p> : null}
      {progress !== undefined ? (
        <p data-testid="scan-progress" role="status">
          {progress.phase ?? "scan"} · {progress.analyzedFiles ?? 0}
          {progress.discoveredFiles !== undefined ? ` / ${progress.discoveredFiles}` : ""} files
          {progress.reusedFiles !== undefined && progress.reusedFiles > 0
            ? ` · ${progress.reusedFiles} reused`
            : ""}
        </p>
      ) : null}
      {snapshot !== undefined && packed !== undefined ? (
        <>
          <section className="card">
            <h2>Coverage snapshot</h2>
            <ul className="metric-grid">
              <li>Discovered files: {snapshot.coverage.discoveredFiles}</li>
              <li>Analyzed files: {snapshot.coverage.analyzedFiles}</li>
              {snapshot.coverage.reusedFiles !== undefined ? (
                <li>Reused files: {snapshot.coverage.reusedFiles}</li>
              ) : null}
              {snapshot.coverage.elapsedMs !== undefined ? (
                <li>Scan time: {snapshot.coverage.elapsedMs} ms</li>
              ) : null}
              <li>Observed edges: {packed.brief.scope.internalEdges}</li>
              <li>Unresolved: {snapshot.coverage.constructCounts.unresolved}</li>
              <li>Unsupported: {snapshot.coverage.constructCounts.unsupported}</li>
              <li>External packages: {packed.brief.externals.length}</li>
              <li>Cycle groups: {packed.brief.cycles.length}</li>
              <li>Entrypoints: {packed.brief.entrypoints.length}</li>
              <li>Leaves: {packed.brief.leaves.length}</li>
              <li>Declared package.json names: {snapshot.coverage.declaredPackages?.length ?? 0}</li>
              <li>Skipped directories: {snapshot.coverage.skippedDirectories ?? 0}</li>
            </ul>
            <p className="muted">
              {snapshot.engineVersion} · {snapshot.parserVersion} · {snapshot.scope.edgePolicy}
              {snapshot.scope.selectedCommit !== undefined
                ? ` · ${snapshot.scope.selectedCommit.slice(0, 12)}`
                : ""}
            </p>
          </section>
          <section className="card">
            <h2>Most imported files</h2>
            <p className="muted">{COPY.impact}</p>
            {packed.brief.hubs.length === 0 ? (
              <p>No internal imported-by counts under the current edge policy.</p>
            ) : (
              <table data-testid="hub-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Imported by</th>
                    <th>Imports</th>
                    <th>Lang</th>
                  </tr>
                </thead>
                <tbody>
                  {packed.brief.hubs.map((hub) => (
                    <tr key={hub.id}>
                      <td>{hub.id}</td>
                      <td>{hub.importedBy}</td>
                      <td>{hub.imports}</td>
                      <td>{hub.language}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {packed.brief.componentEdges.length > 0 ? (
            <section className="card">
              <h2>Component coupling</h2>
              <p className="muted">{COPY.component}</p>
              <table data-testid="component-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Observed file edges</th>
                  </tr>
                </thead>
                <tbody>
                  {packed.brief.componentEdges.slice(0, 16).map((edge) => (
                    <tr key={`${edge.from}>${edge.to}`}>
                      <td>{edge.from}</td>
                      <td>{edge.to}</td>
                      <td>{edge.fileEdges}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
          <section className="card">
            <h2>Cycle groups</h2>
            <p className="muted">{COPY.cycle}</p>
            {packed.brief.cycles.length === 0 ? (
              <p>No observed cycles under the current edge policy.</p>
            ) : (
              <ul>
                {packed.brief.cycles.map((group) => (
                  <li key={group.join(",")}>{group.join(" → ")}</li>
                ))}
              </ul>
            )}
          </section>
          {(snapshot.coverage.declaredPackages?.length ?? 0) > 0 ? (
            <section className="card">
              <h2>Declared package.json names</h2>
              <p className="muted">
                Names from package.json dependency fields. RepoScope does not install or execute them.
              </p>
              <ul>
                {snapshot.coverage.declaredPackages?.slice(0, 40).map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="card">
            <h2>External packages</h2>
            {packed.brief.externals.length === 0 ? (
              <p>No observed external package specifiers.</p>
            ) : (
              <ul>
                {packed.brief.externals.slice(0, 20).map((item) => (
                  <li key={item.name}>
                    {item.name} · {item.importers.length} importer
                    {item.importers.length === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {packed.brief.unresolved.length > 0 ? (
            <section className="card">
              <h2>Unresolved specifiers</h2>
              <p className="muted">{COPY.unresolved}</p>
              <ul>
                {packed.brief.unresolved.slice(0, 12).map((item) => (
                  <li key={`${item.importer}:${item.specifier}`}>
                    {item.importer} → {item.specifier} ({item.reason})
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p>
            <button
              type="button"
              onClick={() => {
                downloadText(
                  `reposcope-brief.md`,
                  packed.markdown,
                  "text/markdown",
                );
              }}
            >
              Download brief
            </button>
          </p>
        </>
      ) : (
        <p>No snapshot yet. Scan a local root or a github.com URL to start.</p>
      )}
    </main>
  );
}
