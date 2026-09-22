import type { ImportObservation } from "@reposcope/contracts";
import type { ReactElement } from "react";
import { COPY } from "../lib/copy.js";
import { truncationLabel } from "../lib/truncation-label.js";
import { useWorkspace } from "../workspace.js";

function isOmission(observation: ImportObservation): boolean {
  return (
    observation.resolution.status === "unresolved" ||
    observation.resolution.status === "unsupported" ||
    observation.resolution.status === "declaration-only" ||
    observation.edgeClass === "type"
  );
}

export function CoveragePage(): ReactElement {
  const { snapshot } = useWorkspace();
  if (snapshot === undefined) {
    return (
      <main className="page">
        <h1>Coverage</h1>
        <p>Scan a repository first.</p>
      </main>
    );
  }
  const counts = snapshot.coverage.constructCounts;
  const omissions = snapshot.observations.filter(isOmission);
  return (
    <main className="page" data-testid="coverage-page">
      <h1>Coverage</h1>
      <p>
        Coverage reports what the engine observed and omitted. It does not prove unused code.{" "}
        {COPY.reused}
      </p>
      <table>
        <tbody>
          <tr>
            <th>Discovered files</th>
            <td>{snapshot.coverage.discoveredFiles}</td>
          </tr>
          <tr>
            <th>Analyzed files</th>
            <td>{snapshot.coverage.analyzedFiles}</td>
          </tr>
          <tr>
            <th>Reused files</th>
            <td>{snapshot.coverage.reusedFiles ?? 0}</td>
          </tr>
          <tr>
            <th>Scan time</th>
            <td>{snapshot.coverage.elapsedMs ?? 0} ms</td>
          </tr>
          <tr>
            <th>Resolver cache hits</th>
            <td>{snapshot.coverage.resolverCacheHits ?? 0}</td>
          </tr>
          <tr>
            <th>Reused resolutions</th>
            <td>{snapshot.coverage.reusedResolutions ?? 0}</td>
          </tr>
          <tr>
            <th>Skipped files</th>
            <td>{snapshot.coverage.skippedFiles}</td>
          </tr>
          <tr>
            <th>Skipped directories</th>
            <td>{snapshot.coverage.skippedDirectories ?? 0}</td>
          </tr>
          <tr>
            <th>Declared package.json names</th>
            <td>{snapshot.coverage.declaredPackages?.length ?? 0}</td>
          </tr>
          <tr>
            <th>Parse failures</th>
            <td>{snapshot.coverage.parseFailures}</td>
          </tr>
          <tr>
            <th>Internal</th>
            <td>{counts.internal}</td>
          </tr>
          <tr>
            <th>External</th>
            <td>{counts.external}</td>
          </tr>
          <tr>
            <th>Unresolved</th>
            <td>{counts.unresolved}</td>
          </tr>
          <tr>
            <th>Unsupported</th>
            <td>{counts.unsupported}</td>
          </tr>
          <tr>
            <th>Type-only</th>
            <td>{counts.typeOnly}</td>
          </tr>
          <tr>
            <th>Mixed</th>
            <td>{counts.mixed}</td>
          </tr>
        </tbody>
      </table>
      {(snapshot.coverage.declaredPackages?.length ?? 0) > 0 ? (
        <section>
          <h2>Declared package.json names</h2>
          <p className="muted">Catalog only. These names are not installed and are not treated as internals.</p>
          <ul>
            {snapshot.coverage.declaredPackages?.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {snapshot.coverage.truncations.length > 0 ? (
        <section>
          <h2>Truncations</h2>
          <ul>
            {snapshot.coverage.truncations.map((item) => (
              <li key={item}>{truncationLabel(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section data-testid="coverage-omissions">
        <h2>Visible omissions</h2>
        <p className="muted">{COPY.unresolved}</p>
        {omissions.length === 0 ? (
          <p>No unresolved, unsupported, declaration-only, or type-only observations.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Importer</th>
                <th>Specifier</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {omissions.map((item) => (
                <tr key={item.id}>
                  <td>{item.importerId}</td>
                  <td>{item.specifier}</td>
                  <td>{item.resolution.status}</td>
                  <td>{item.resolution.reasonCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Files</h2>
        <ul>
          {snapshot.nodes.map((node) => (
            <li key={node.id}>
              {node.id} · {node.parseStatus}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
