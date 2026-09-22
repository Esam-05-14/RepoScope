import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ReactElement } from "react";

export interface FileGraphData {
  path: string;
  title: string;
  subtitle: string;
  inbound: number;
  outbound: number;
  role: string;
  inCycle: boolean;
}

export interface LibraryGraphData {
  name: string;
  kind: string;
  importers: number;
}

export interface ComponentGraphData {
  title: string;
  subtitle: string;
}

function asRecord(data: unknown): Record<string, unknown> {
  return data !== null && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export function FileGraphNode(props: NodeProps): ReactElement {
  const data = asRecord(props.data);
  const selected = props.selected === true;
  const inCycle = data.inCycle === true;
  return (
    <div
      className={`graph-node graph-node-file${selected ? " is-selected" : ""}${inCycle ? " is-cycle" : ""}`}
      title={String(data.path ?? "")}
    >
      <Handle type="target" position={Position.Left} />
      <div className="graph-node-title">{String(data.title ?? "")}</div>
      <div className="graph-node-sub">{String(data.subtitle ?? "")}</div>
      <div className="graph-node-meta">
        in {Number(data.inbound ?? 0)} · out {Number(data.outbound ?? 0)}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function LibraryGraphNode(props: NodeProps): ReactElement {
  const data = asRecord(props.data);
  return (
    <div
      className={`graph-node graph-node-library${props.selected === true ? " is-selected" : ""}`}
      title={String(data.name ?? "")}
    >
      <Handle type="target" position={Position.Left} />
      <div className="graph-node-title">{String(data.name ?? "")}</div>
      <div className="graph-node-sub">{data.kind === "builtin" ? "runtime builtin" : "observed library"}</div>
      <div className="graph-node-meta">{Number(data.importers ?? 0)} importers</div>
    </div>
  );
}

export function ComponentGraphNode(props: NodeProps): ReactElement {
  const data = asRecord(props.data);
  return (
    <div
      className={`graph-node graph-node-component${props.selected === true ? " is-selected" : ""}`}
      title={String(data.title ?? "")}
    >
      <Handle type="target" position={Position.Left} />
      <div className="graph-node-title">{String(data.title ?? "")}</div>
      <div className="graph-node-sub">{String(data.subtitle ?? "")}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
