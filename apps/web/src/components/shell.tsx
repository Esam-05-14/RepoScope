import type { ReactElement } from "react";
import { currentRoute, navigate, type Route } from "../lib/router.js";

const LINKS: { route: Route; label: string }[] = [
  { route: "/", label: "Overview" },
  { route: "/explore", label: "Explore" },
  { route: "/coverage", label: "Coverage" },
  { route: "/compare", label: "Compare" },
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
        <p data-testid="status-line" className="status-chip">
          {props.status}
          {props.label !== undefined ? ` · ${props.label}` : ""}
        </p>
      </header>
      {props.children}
    </div>
  );
}
