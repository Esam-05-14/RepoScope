# RepoScope editor command

Thin VS Code command used by the local RepoScope session. It opens a workspace-relative path already present in a snapshot. It does not scan, install, or run the inspected project.

The loopback API still launches `code -g` (or `REPOSCOPE_EDITOR`) after confining the path to the CLI-selected root.
