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
      env: { ...process.env, REPOSCOPE_SESSION_TOKEN: token },
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

test("scan fixture, inspect money.ts evidence, and open coverage", async ({ page }) => {
  const server = await startDemo();
  try {
    await page.goto(`http://127.0.0.1:${server.port}/#token=${token}`);
    await expect(page.getByTestId("status-line")).toContainText("scan-ready");
    await page.getByRole("button", { name: "Scan", exact: true }).click();
    await expect(page.getByText("Discovered files: 5")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Explore" }).click();
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
