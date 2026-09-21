export const COPY = {
  arrow: "Arrow A → B means A has an observed dependency on B (A imports B).",
  impact: "Potential investigation scope: files with an observed dependency chain onto the selection.",
  unresolved: "Not resolved under this configuration.",
  typeOnly: "Declared type-only import — omitted from the default graph.",
  cycle: "A cycle group is an observed strongly connected set. It is not automatically a defect.",
  compareBlocked: "These snapshots are not comparable as an architecture change.",
} as const;
