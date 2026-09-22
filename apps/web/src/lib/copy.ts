export const COPY = {
  arrow: "Arrow A → B means A has an observed dependency on B (A imports B).",
  impact: "Potential investigation scope: files with an observed dependency chain onto the selection.",
  unresolved: "Not resolved under this configuration.",
  typeOnly: "Declared type-only import — omitted from the default graph.",
  cycle: "A cycle group is an observed strongly connected set. It is not automatically a defect.",
  compareBlocked: "These snapshots are not comparable as an architecture change.",
  declaredNames:
    "Declared binding names on the import. This is not proof the binding is used.",
  reused: "Unchanged files reused from the previous snapshot by content hash.",
  require: "Declared CommonJS require with a string specifier.",
  brief:
    "Compact observed-dependency brief for a human or a separately chosen assistant. RepoScope does not call a model.",
  briefPrivacy:
    "The brief lists repository paths. Pasting it into a cloud assistant leaves this machine.",
  yourCode:
    "Your code: observed file imports inside this repository. Workspace package names resolve to those files when package.json exports or entry fields point at inventoried source.",
  libraries:
    "Libraries: observed npm and node:/bun: specifiers. RepoScope does not install or execute them. They are not internal graph nodes unless you open this lens.",
  asset: "Stylesheets and other non-source specifiers are recorded as unsupported assets, not silent omissions.",
  dynamicImport: "Dynamic import() is omitted unless you opt in. A string specifier is still not runtime proof.",
  component:
    "A component is a directory or workspace package prefix. Rolled-up edges count observed file imports between those prefixes.",
  boundary:
    "This file has an observed dependency that crosses a component prefix. That is not a runtime boundary.",
  barrel: "Internal observations on this file are export-from only. That is a barrel shape, not unused-code proof.",
  coImported: "Other files imported by the same importers. Shared investigation scope, not a coupling verdict.",
} as const;
