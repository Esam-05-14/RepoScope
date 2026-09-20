import { randomBytes } from "node:crypto";
import {
  type RootKind,
  type ScanStatus,
} from "@reposcope/contracts";

export interface Session {
  readonly token: string;
  readonly rootKind: RootKind;
  readonly rootLabel: string;
  readonly canonicalRoot: string | null;
  scanStatus: ScanStatus;
  boundPort: number | null;
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function createSession(input: {
  rootKind: RootKind;
  rootLabel: string;
  canonicalRoot: string | null;
  token?: string;
}): Session {
  return {
    token: input.token ?? createSessionToken(),
    rootKind: input.rootKind,
    rootLabel: input.rootLabel,
    canonicalRoot: input.canonicalRoot,
    scanStatus: "idle",
    boundPort: null,
  };
}

export function allowedHost(session: Session): string | null {
  if (session.boundPort === null) {
    return null;
  }
  return `127.0.0.1:${session.boundPort}`;
}

export function allowedOrigin(session: Session): string | null {
  const host = allowedHost(session);
  return host === null ? null : `http://${host}`;
}

export function createDiagnosticId(): string {
  return `rs_${randomBytes(8).toString("hex")}`;
}
