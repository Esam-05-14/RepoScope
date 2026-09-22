import type { ReactElement } from "react";
import { currentRoute, navigate, type Route } from "../lib/router.js";
import { statusLabel } from "../status-line.js";

const LINKS: { route: Route; label: string }[] = [
  { route: "/", label: "Overview" },
  { route: "/explore", label: "Explore" },
  { route: "/coverage", label: "Coverage" },
  { route: "/brief", label: "Brief" },
  { route: "/compare", label: "Compare" },
  { route: "/boundaries", label: "Boundaries" },
  { route: "/settings", label: "Settings" },
];

export function Shell(props: {
  status: string;
  label?: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  const route = currentRoute();
  return (
    <div className="shell">
      <header className="topbar">
        <strong>RepoScope</strong>
        <nav aria-label="Primary">
          {LINKS.map((link) => (
            <a
              key={link.route}
              href={link.route}
              aria-current={route === link.route ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(link.route);
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p data-testid="status-line" data-state={props.status} className="status-chip">
          {statusLabel(props.status)}
          {props.label !== undefined ? ` · ${props.label}` : ""}
        </p>
      </header>
      {props.children}
    </div>
  );
}
