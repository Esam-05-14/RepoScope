import { useMemo, type ReactElement } from "react";

export function FileTree(props: {
  paths: readonly string[];
  selected?: string;
  query: string;
  onSelect: (id: string) => void;
}): ReactElement {
  const filtered = useMemo(() => {
    const q = props.query.trim().toLowerCase();
    if (q === "") {
      return props.paths;
    }
    return props.paths.filter((path) => path.toLowerCase().includes(q));
  }, [props.paths, props.query]);

  return (
    <div className="file-tree" data-testid="file-tree">
      <ul className="file-list">
        {filtered.map((path) => (
          <li key={path}>
            <button
              type="button"
              className={path === props.selected ? "selected" : undefined}
              onClick={() => {
                props.onSelect(path);
              }}
            >
              {path}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
