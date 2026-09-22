import type { ReactElement } from "react";

export type ShellState =
  | "no-session"
  | "no-root"
  | "scan-ready"
  | "scanning"
  | "canceled"
  | "failed"
  | "partial"
  | "completed"
  | "error";

const LABELS: Record<string, string> = {
  "no-session": "No session — use the tab the CLI opened (token is in the URL fragment)",
  "no-root": "No repository selected",
  "scan-ready": "Ready to scan",
  scanning: "Scanning",
  canceled: "Canceled",
  failed: "Failed",
  partial: "Partial",
  completed: "Scan complete",
  error: "Error",
};

export function statusLabel(state: string): string {
  return LABELS[state] ?? state;
}

export function StatusLine(props: {
  state: ShellState;
  label?: string;
}): ReactElement {
  return (
    <p data-testid="status-line" data-state={props.state}>
      {statusLabel(props.state)}
      {props.label !== undefined ? ` · ${props.label}` : ""}
    </p>
  );
}
