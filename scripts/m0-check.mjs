import { existsSync } from "node:fs";
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

const browser = await chromium.launch({
  executablePath,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];

page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.stack ?? error.message}`);
});
page.on("requestfailed", (request) => {
  logs.push(
    `[requestfailed] ${request.url()} ${request.failure()?.errorText ?? ""}`,
  );
});

await page.goto("http://localhost:3000/m0", { waitUntil: "networkidle" });
await page.waitForSelector(".react-flow__node", { timeout: 10000 });
await page.waitForTimeout(500);

const before = await page.evaluate(() => ({
  nodes: document.querySelectorAll(".react-flow__node").length,
  edges: document.querySelectorAll(".react-flow__edge").length,
  chips: document.querySelectorAll(".dimension-chip").length,
}));

const firstChip = page.locator(".dimension-chip").first();
const chipTextBefore = (await firstChip.innerText()).replace(/\s+/g, " ");
const chipBoxBefore = await firstChip.boundingBox();
await firstChip.click();
await page.waitForSelector(".dimension-popover", { timeout: 5000 });
const popoverVisible = await page.locator(".dimension-popover").first().isVisible();
const popoverText = (await page.locator(".dimension-popover").first().innerText())
  .replace(/\s+/g, " ")
  .slice(0, 120);

const firstDetail = page
  .locator(".detail-button")
  .filter({ hasText: "时间成本" })
  .first();
const detailText = await firstDetail.innerText();
await firstDetail.click();
const chipTextAfter = (await firstChip.innerText()).replace(/\s+/g, " ");
await page.screenshot({
  path: "C:\\temp\\opencode\\m0-popover.png",
  fullPage: true,
});
await page.locator(".primary-button").first().click();

const node = page
  .locator(".react-flow__node")
  .filter({ hasText: "远程办公" })
  .first();
const nodeBox = await node.boundingBox();
if (!nodeBox) throw new Error("node box missing");
await page.mouse.move(nodeBox.x + 90, nodeBox.y + 22);
await page.mouse.down();
await page.mouse.move(nodeBox.x + 150, nodeBox.y + 52, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(500);
const chipBoxAfterDrag = await firstChip.boundingBox();
const chipMoved =
  !!chipBoxBefore &&
  !!chipBoxAfterDrag &&
  (Math.abs(chipBoxBefore.x - chipBoxAfterDrag.x) > 2 ||
    Math.abs(chipBoxBefore.y - chipBoxAfterDrag.y) > 2);

const chipsBeforeAdd = await page.locator(".dimension-chip").count();
await page.locator(".edge-add").first().click({ force: true });
await page.waitForTimeout(300);
const chipsAfterAdd = await page.locator(".dimension-chip").count();

const viewport = page.locator(".react-flow__viewport");
const transformBefore = await viewport.getAttribute("style");
await page.mouse.move(720, 480);
await page.mouse.wheel(0, -320);
await page.waitForTimeout(350);
const transformAfterZoom = await viewport.getAttribute("style");
const zoomed = transformBefore !== transformAfterZoom;

await page.mouse.move(700, 620);
await page.mouse.down();
await page.mouse.move(790, 660, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(350);
const transformAfterPan = await viewport.getAttribute("style");
const panned = transformAfterZoom !== transformAfterPan;

console.log(
  JSON.stringify(
    {
      before,
      chipTextBefore,
      chipTextAfter,
      detailText,
      popoverVisible,
      popoverText,
      chipMoved,
      chipsBeforeAdd,
      chipsAfterAdd,
      zoomed,
      panned,
      logs,
    },
    null,
    2,
  ),
);

await page.screenshot({
  path: "C:\\temp\\opencode\\m0-playwright.png",
  fullPage: true,
});

await browser.close();
