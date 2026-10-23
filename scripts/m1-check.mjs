import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { chromium } from "playwright-core";

const candidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((value) => Boolean(value));

const executablePath = candidates.find((value) => existsSync(value));
if (!executablePath) {
  throw new Error(
    "No Chrome / Edge found. Set CHROME_PATH to a Chromium executable.",
  );
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const logs = [];

page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.stack ?? error.message}`);
});

try {
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const landedUrl = page.url();
  const navLabels = await page.locator(".workspace-nav-label").allInnerTexts();
  const inspirationText = await page.locator(".workspace-main").innerText();
  const healthBefore = await (
    await fetch("http://localhost:3000/api/health")
  ).json();

  await page.fill("#title", "M1 测试灵感");
  await page.fill("#content", "由 m1-check 写入，测试后删除。");
  await page.getByRole("button", { name: "添加灵感" }).click();
  await page.waitForTimeout(900);

  const inspirationVisible = await page
    .getByText("M1 测试灵感", { exact: true })
    .first()
    .isVisible();
  const healthAfterInspiration = await (
    await fetch("http://localhost:3000/api/health")
  ).json();

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /画布/ })
    .click();
  await page.waitForURL("**/canvases");

  const canvasText = await page.locator(".workspace-main").innerText();
  await page.fill("#name", "M1 测试画布");
  await page.fill("#description", "测试后删除");
  await page.getByRole("button", { name: "新建画布" }).click();
  await page.waitForTimeout(900);

  const canvasVisible = await page
    .getByText("M1 测试画布", { exact: true })
    .first()
    .isVisible();

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /文档/ })
    .click();
  await page.waitForURL("**/documents");

  const documentText = await page.locator(".workspace-main").innerText();
  await page.getByRole("link", { name: /打开/ }).first().click();
  await page.waitForURL(/\/documents\/[^/]+$/);

  const detailText = await page.locator(".document-body").innerText();
  const detailUrl = page.url();

  await page.screenshot({
    path: "C:\\temp\\opencode\\m1.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        landedUrl,
        navLabels,
        inspirationText: inspirationText.slice(0, 300),
        healthBefore,
        healthAfterInspiration,
        inspirationVisible,
        canvasText: canvasText.slice(0, 300),
        canvasVisible,
        documentText: documentText.slice(0, 300),
        detailUrl,
        detailText: detailText.slice(0, 300),
        logs,
      },
      null,
      2,
    ),
  );
} finally {
  const db = new Database("./data/app.db");
  db.prepare("DELETE FROM inspirations WHERE title = ?").run("M1 测试灵感");
  db.prepare("DELETE FROM canvases WHERE name = ?").run("M1 测试画布");
  db.close();

  await browser.close();
}
