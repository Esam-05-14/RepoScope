import type { ReactElement } from "react";
import { useWorkspace } from "../workspace.js";

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
  return (
    <main className="page" data-testid="coverage-page">
      <h1>Coverage</h1>
      <p>
        Coverage reports what the engine observed and omitted. It does not prove unused code.
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
            <th>Skipped files</th>
            <td>{snapshot.coverage.skippedFiles}</td>
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
      {snapshot.coverage.truncations.length > 0 ? (
        <section>
          <h2>Truncations</h2>
          <ul>
            {snapshot.coverage.truncations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
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
