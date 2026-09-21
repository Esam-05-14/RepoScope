import { useEffect, useState, type ReactElement } from "react";
import { Shell } from "./components/shell.js";
import { fetchHealth } from "./lib/api.js";
import { currentRoute, onRouteChange } from "./lib/router.js";
import { ComparePage } from "./pages/compare.js";
import { CoveragePage } from "./pages/coverage.js";
import { ExplorePage } from "./pages/explore.js";
import { HomePage } from "./pages/home.js";
import { SettingsPage } from "./pages/settings.js";
import { getSessionToken, takeTokenFromLocation } from "./session.js";
import { StatusLine, type ShellState } from "./status-line.js";
import { WorkspaceProvider } from "./workspace.js";

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
  if (body.scan.status === "completed") {
    return "completed";
  }
  return "scan-ready";
}

function RouteBody(props: { rootKind: string; status: string }): ReactElement {
  const route = currentRoute();
  if (route === "/explore") {
    return <ExplorePage />;
  }
  if (route === "/coverage") {
    return <CoveragePage />;
  }
  if (route === "/compare") {
    return <ComparePage />;
  }
  if (route === "/settings") {
    return <SettingsPage />;
  }
  return <HomePage rootKind={props.rootKind} status={props.status} />;
}

export function App(): ReactElement {
  const [state, setState] = useState<ShellState>("no-session");
  const [label, setLabel] = useState<string | undefined>();
  const [rootKind, setRootKind] = useState("none");
  const [, setRouteTick] = useState(0);

  useEffect(() => {
    return onRouteChange(() => {
      setRouteTick((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    takeTokenFromLocation(window.location);
    const token = getSessionToken();
    if (token === null) {
      setState("no-session");
      return;
    }
    const load = (): void => {
      void fetchHealth()
        .then((body) => {
          setLabel(body.root.label);
          setRootKind(body.root.kind);
          setState(stateFromHealth(body));
        })
        .catch(() => {
          setState("error");
        });
    };
    load();
    window.addEventListener("reposcope:scanned", load);
    return () => window.removeEventListener("reposcope:scanned", load);
  }, []);

  if (state === "no-session") {
    return (
      <main className="page">
        <h1>RepoScope</h1>
        <StatusLine state={state} />
      </main>
    );
  }

  return (
    <WorkspaceProvider>
      <Shell status={state} label={label}>
        <RouteBody rootKind={rootKind} status={state} />
      </Shell>
    </WorkspaceProvider>
  );
}
