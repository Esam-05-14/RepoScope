import { describe, expect, it } from "vitest";
import {
  getSessionToken,
  setSessionTokenForTests,
  takeTokenFromLocation,
} from "../../apps/web/src/session.ts";

function mockSessionStorage(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  return store;
}

describe("browser session token", () => {
  it("stores the fragment token in memory and strips it from the URL", () => {
    setSessionTokenForTests(null);
    const replaced: string[] = [];
    const location = {
      hash: "#token=secret-value",
      pathname: "/",
      search: "",
    };
    expect(takeTokenFromLocation(location, (url) => replaced.push(url))).toBe(
      "secret-value",
    );
    expect(getSessionToken()).toBe("secret-value");
    expect(replaced[0]).toBe("/");
    setSessionTokenForTests(null);
  });

  it("restores a token from sessionStorage after a reload without a hash", () => {
    mockSessionStorage();
    setSessionTokenForTests(null);
    takeTokenFromLocation(
      { hash: "#token=kept-across-reload", pathname: "/", search: "" },
      () => undefined,
    );
    setSessionTokenForTests(null);
    expect(
      takeTokenFromLocation({ hash: "", pathname: "/", search: "" }, () => undefined),
    ).toBe("kept-across-reload");
    setSessionTokenForTests(null);
  });
});
