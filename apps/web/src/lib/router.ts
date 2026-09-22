export type Route =
  | "/"
  | "/explore"
  | "/coverage"
  | "/compare"
  | "/boundaries"
  | "/brief"
  | "/settings";

const ROUTES = new Set<Route>([
  "/",
  "/explore",
  "/coverage",
  "/compare",
  "/boundaries",
  "/brief",
  "/settings",
]);

export function currentRoute(): Route {
  const path = window.location.pathname;
  if (ROUTES.has(path as Route)) {
    return path as Route;
  }
  return "/";
}

export function navigate(route: Route): void {
  const next = `${route}${window.location.search}${window.location.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
    history.pushState(null, "", next);
  }
  window.dispatchEvent(new Event("reposcope:route"));
}

export function onRouteChange(handler: () => void): () => void {
  const wrapped = (): void => {
    handler();
  };
  window.addEventListener("popstate", wrapped);
  window.addEventListener("reposcope:route", wrapped);
  return () => {
    window.removeEventListener("popstate", wrapped);
    window.removeEventListener("reposcope:route", wrapped);
  };
}
