export type Route = "/" | "/explore" | "/coverage" | "/compare" | "/settings";

const ROUTES = new Set<Route>(["/", "/explore", "/coverage", "/compare", "/settings"]);

export function currentRoute(): Route {
  const path = window.location.pathname;
  if (ROUTES.has(path as Route)) {
    return path as Route;
  }
  return "/";
}

export function navigate(route: Route): void {
  if (window.location.pathname !== route) {
    history.pushState(null, "", route);
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
