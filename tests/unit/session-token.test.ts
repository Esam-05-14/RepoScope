import { describe, expect, it } from "vitest";
import {
  getSessionToken,
  setSessionTokenForTests,
  takeTokenFromLocation,
} from "../../apps/web/src/session.ts";

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
});
