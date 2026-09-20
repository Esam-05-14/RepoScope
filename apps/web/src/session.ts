let memoryToken: string | null = null;

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
  if (token !== null && token.length > 0) {
    memoryToken = token;
    replaceUrl(`${location.pathname}${location.search}`);
  }
  return memoryToken;
}

export function getSessionToken(): string | null {
  return memoryToken;
}

export function setSessionTokenForTests(token: string | null): void {
  memoryToken = token;
}
