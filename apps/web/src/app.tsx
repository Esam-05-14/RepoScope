import { useEffect, useState, type ReactElement } from "react";
import { getSessionToken, takeTokenFromLocation } from "./session.js";
import { StatusLine, type ShellState } from "./status-line.js";

interface HealthBody {
  root: { kind: string; label: string };
  scan: { status: string };
}

function stateFromHealth(body: HealthBody): ShellState {
  if (body.root.kind === "none") {
    return "no-root";
  }
  if (body.scan.status === "idle") {
    return "scan-ready";
  }
  if (
    body.scan.status === "scanning" ||
    body.scan.status === "canceled" ||
    body.scan.status === "failed" ||
    body.scan.status === "partial"
  ) {
    return body.scan.status;
  }
  return "scan-ready";
}

export function App(): ReactElement {
  const [state, setState] = useState<ShellState>("no-session");
  const [label, setLabel] = useState<string | undefined>();

  useEffect(() => {
    takeTokenFromLocation(window.location);
    const token = getSessionToken();
    if (token === null) {
      setState("no-session");
      return;
    }
    void fetch("/api/health", {
      headers: { authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          setState("error");
          return;
        }
        const body = (await response.json()) as HealthBody;
        setLabel(body.root.label);
        setState(stateFromHealth(body));
      })
      .catch(() => {
        setState("error");
      });
  }, []);

  return (
    <main>
      <h1>RepoScope</h1>
      <p>Local investigation shell. No remote analysis.</p>
      <StatusLine state={state} label={label} />
    </main>
  );
}
