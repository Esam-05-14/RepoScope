import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusLine } from "./status-line.js";

describe("StatusLine", () => {
  it("renders the scan-ready state", () => {
    const html = renderToStaticMarkup(
      createElement(StatusLine, { state: "scan-ready", label: "fixtures/esm-baseline" }),
    );
    expect(html).toContain("scan-ready");
    expect(html).toContain("fixtures/esm-baseline");
  });
});
