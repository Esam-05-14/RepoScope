import { useState, type ReactElement } from "react";
import { evaluateBoundaries } from "../lib/api.js";
import { useWorkspace } from "../workspace.js";

const EXAMPLE = `{
  "schemaVersion": "1.0.0",
  "groups": {
    "lib": ["src/lib/**"],
    "app": ["src/main.ts", "src/app.ts"]
  },
  "forbid": [{ "id": "lib-must-not-import-app", "from": "lib", "to": "app" }]
}`;

export function BoundariesPage(): ReactElement {
  const workspace = useWorkspace();
  const [policyText, setPolicyText] = useState(EXAMPLE);
  const [error, setError] = useState<string>();
  const [violations, setViolations] = useState<
    {
      ruleId: string;
      observationId: string;
      importerId: string;
      targetId: string;
      fromGroup: string;
      toGroup: string;
    }[]
  >();

  async function evaluate(): Promise<void> {
    setError(undefined);
    setViolations(undefined);
    if (workspace.snapshotId === undefined) {
      setError("Scan a repository first.");
      return;
    }
    let policy: unknown;
    try {
      policy = JSON.parse(policyText);
    } catch {
      setError("Boundary policy must be JSON.");
      return;
    }
    try {
      const result = await evaluateBoundaries(workspace.snapshotId, policy);
      setViolations(result.violations);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "evaluate failed");
    }
  }

  return (
    <main className="page" data-testid="boundaries-page">
      <h1>Boundary policy</h1>
      <p>
        Declarative group rules over observed file-level edges. A violation cites the rule and the
        observation. This is not a runtime or refactoring guarantee.
      </p>
      <label className="policy-editor">
        Policy JSON
        <textarea
          data-testid="boundary-policy"
          value={policyText}
          onChange={(event) => {
            setPolicyText(event.target.value);
          }}
          rows={14}
          spellCheck={false}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          data-testid="evaluate-boundaries"
          disabled={workspace.snapshotId === undefined}
          onClick={() => {
            void evaluate();
          }}
        >
          Evaluate policy
        </button>
      </div>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {violations !== undefined ? (
        <section>
          <h2>Violations</h2>
          {violations.length === 0 ? (
            <p>No observed edges match a forbid rule.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Importer</th>
                  <th>Target</th>
                  <th>Groups</th>
                  <th>Observation</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((item) => (
                  <tr key={`${item.ruleId}:${item.observationId}`}>
                    <td>{item.ruleId}</td>
                    <td>{item.importerId}</td>
                    <td>{item.targetId}</td>
                    <td>
                      {item.fromGroup} → {item.toGroup}
                    </td>
                    <td>{item.observationId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </main>
  );
}
