import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const workspace = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const token = "c".repeat(64);

async function startDemo(): Promise<{ port: number; close: () => void }> {
  const cli = path.join(workspace, "apps", "cli", "dist", "main.js");
  const child = spawn(
    process.execPath,
    [cli, "inspect", "--demo", "--no-open", "--port", "0"],
    {
      cwd: workspace,
      env: { ...process.env, REPOSCOPE_SESSION_TOKEN: token, REPOSCOPE_PERSIST: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("demo server did not start"));
    }, 20_000);
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(text);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve(Number.parseInt(match[1], 10));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text.includes("Error")) {
        clearTimeout(timer);
        reject(new Error(text));
      }
    });
  });
  return {
    port,
    close: () => {
      child.kill();
    },
  };
}

async function openDemo(page: import("@playwright/test").Page, port: number): Promise<void> {
  await page.goto(`http://127.0.0.1:${port}/#token=${token}`);
  await expect(page.getByTestId("status-line")).toHaveAttribute("data-state", "scan-ready");
}

test("scan fixture, inspect money.ts evidence, and open coverage", async ({ page }) => {
  const server = await startDemo();
  try {
    await openDemo(page, server.port);
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await expect(page.getByText("Discovered files: 5")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Explore" }).click();
    await expect(page.getByTestId("lens-investigation")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("lens-libraries").click();
    await expect(page.getByTestId("lens-libraries")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("lens-investigation").click();
    await page.getByRole("button", { name: "src/lib/money.ts", exact: true }).click();
    await expect(page.getByText("Direct importers: src/app.ts")).toBeVisible();
    await expect(page.getByText("src/main.ts → src/app.ts → src/lib/money.ts")).toBeVisible();
    await expect(page.getByTestId("evidence-status")).toContainText("current");
    await expect(page.getByTestId("evidence-snippet")).toContainText("./lib/money.js");
    await page.screenshot({
      path: path.join(workspace, "reports", "demo-explore.png"),
    });
    await page.getByRole("link", { name: "Coverage" }).click();
    await expect(page.getByTestId("coverage-page")).toContainText("Analyzed files");
    await expect(page.getByTestId("coverage-page")).toContainText("5");
  } finally {
    server.close();
  }
});

test("compare baseline and revised fixtures", async ({ page }) => {
  const server = await startDemo();
  try {
    await openDemo(page, server.port);
    await page.getByRole("link", { name: "Compare" }).click();
    await page.getByTestId("load-compare-fixtures").click();
    await expect(page.getByTestId("base-snapshot")).toHaveValue(/.+/, { timeout: 30_000 });
    await expect(page.getByTestId("target-snapshot")).toHaveValue(/.+/);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await expect(page.getByTestId("added-edges")).toContainText(
      "src/lib/money.ts>|internal:src/main.ts|static-import|value",
    );
  } finally {
    server.close();
  }
});

test("unresolved import remains visible on coverage", async ({ page }) => {
  const server = await startDemo();
  try {
    await openDemo(page, server.port);
    await page.getByTestId("scan-unresolved").click();
    await expect(page.getByText("Unresolved: 1")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Coverage" }).click();
    await expect(page.getByTestId("coverage-omissions")).toContainText("./does-not-exist.js");
    await expect(page.getByTestId("coverage-omissions")).toContainText("unresolved");
  } finally {
    server.close();
  }
});
