import type { ReactElement } from "react";

export type ShellState =
  | "no-session"
  | "no-root"
  | "scan-ready"
  | "scanning"
  | "canceled"
  | "failed"
  | "partial"
  | "error";

export function StatusLine(props: {
  state: ShellState;
  label?: string;
}): ReactElement {
  return (
    <p data-testid="status-line">
      {props.state}
      {props.label !== undefined ? ` · ${props.label}` : ""}
    </p>
  );
}
