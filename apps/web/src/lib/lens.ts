import { useEffect, useState } from "react";
import { isViewLens, type ViewLens } from "@reposcope/contracts";

const STORAGE_KEY = "reposcope.lens";

function readLens(): ViewLens {
  if (typeof sessionStorage === "undefined") {
    return "investigation";
  }
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored !== null && isViewLens(stored) ? stored : "investigation";
}

export function useViewLens(): [ViewLens, (next: ViewLens) => void] {
  const [lens, setLens] = useState<ViewLens>(readLens);
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, lens);
  }, [lens]);
  return [lens, setLens];
}
