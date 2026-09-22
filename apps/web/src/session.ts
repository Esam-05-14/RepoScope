const STORAGE_KEY = "reposcope.session";

let memoryToken: string | null = null;

function persistToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token === null) {
      globalThis.sessionStorage?.removeItem(STORAGE_KEY);
    } else {
      globalThis.sessionStorage?.setItem(STORAGE_KEY, token);
    }
  } catch {
    // Node tests and blocked storage.
  }
}

function restoreStored(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function takeTokenFromLocation(
  location: Pick<Location, "hash" | "pathname" | "search">,
  replaceUrl: (url: string) => void = (url) => {
    history.replaceState(null, "", url);
  },
): string | null {
  const hash = location.hash.startsWith("#")
    ? location.hash.slice(1)
    : location.hash;
  const params = new URLSearchParams(hash);
  const token = params.get("token");
  if (token !== undefined && token !== null && token.length > 0) {
    persistToken(token);
    replaceUrl(`${location.pathname}${location.search}`);
  } else if (memoryToken === null) {
    persistToken(restoreStored());
  }
  return memoryToken;
}

export function getSessionToken(): string | null {
  return memoryToken;
}

export function setSessionTokenForTests(token: string | null): void {
  memoryToken = token;
}
