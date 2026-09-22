import { useMemo, type ReactElement } from "react";

interface DirNode {
  name: string;
  files: { path: string; name: string }[];
  dirs: Map<string, DirNode>;
}

function emptyDir(name: string): DirNode {
  return { name, files: [], dirs: new Map() };
}

function insertPath(root: DirNode, filePath: string): void {
  const parts = filePath.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) {
    return;
  }
  let current = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const name = parts[index] ?? "";
    let next = current.dirs.get(name);
    if (next === undefined) {
      next = emptyDir(name);
      current.dirs.set(name, next);
    }
    current = next;
  }
  const name = parts[parts.length - 1] ?? filePath;
  current.files.push({ path: filePath, name });
}

function FileEntries(props: {
  node: DirNode;
  selected?: string;
  importedBy?: ReadonlyMap<string, number>;
  onSelect: (id: string) => void;
}): ReactElement {
  const dirs = [...props.node.dirs.values()].sort((left, right) => left.name.localeCompare(right.name));
  const files = [...props.node.files].sort((left, right) => left.path.localeCompare(right.path));
  return (
    <ul className="file-list">
      {dirs.map((dir) => (
        <li key={`dir:${dir.name}`}>
          <div className="tree-dir" aria-hidden="true">
            {dir.name}/
          </div>
          <FileEntries
            node={dir}
            selected={props.selected}
            importedBy={props.importedBy}
            onSelect={props.onSelect}
          />
        </li>
      ))}
      {files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            className={file.path === props.selected ? "selected" : undefined}
            aria-label={file.path}
            onClick={() => {
              props.onSelect(file.path);
            }}
          >
            {file.name}
            {props.importedBy !== undefined && (props.importedBy.get(file.path) ?? 0) > 0 ? (
              <span className="muted" aria-hidden="true">
                {` · ${props.importedBy.get(file.path)} in`}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FileTree(props: {
  paths: readonly string[];
  selected?: string;
  query: string;
  importedBy?: ReadonlyMap<string, number>;
  onSelect: (id: string) => void;
}): ReactElement {
  const filtered = useMemo(() => {
    const q = props.query.trim().toLowerCase();
    if (q === "") {
      return props.paths;
    }
    return props.paths.filter((filePath) => filePath.toLowerCase().includes(q));
  }, [props.paths, props.query]);

  const tree = useMemo(() => {
    const root = emptyDir("");
    for (const filePath of filtered) {
      insertPath(root, filePath);
    }
    return root;
  }, [filtered]);

  return (
    <div className="file-tree" data-testid="file-tree">
      <FileEntries
        node={tree}
        selected={props.selected}
        importedBy={props.importedBy}
        onSelect={props.onSelect}
      />
    </div>
  );
}
