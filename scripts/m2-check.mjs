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
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const logs = [];

page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.stack ?? error.message}`);
});

function cardByTitle(title) {
  return page.locator(".inspiration-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

try {
  await page.goto("http://localhost:3000/inspirations", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);

  const healthBefore = await (
    await fetch("http://localhost:3000/api/health")
  ).json();

  for (const item of [
    {
      title: "M2 测试 A",
      content: "远程办公让沟通变慢，但降低通勤成本。",
    },
    {
      title: "M2 测试 B",
      content: "团队创新需要高频碰撞和非正式交流。",
    },
  ]) {
    await page.fill("#title", item.title);
    await page.fill("#content", item.content);
    await page.getByRole("button", { name: "添加灵感" }).click();
    await page
      .getByRole("heading", { name: item.title, exact: true })
      .waitFor();
  }

  const cardA = cardByTitle("M2 测试 A");
  const autoKeywordText = await cardA.locator(".tag").first().innerText();
  const autoKeywordCount = await cardA.locator(".tag").count();

  await cardA.locator('input[name="keyword"]').fill("测试关键词");
  await cardA.locator(".inline-form button").click();
  await page.getByText("#测试关键词", { exact: true }).waitFor();

  const keywordForm = cardA
    .locator("form.tag")
    .filter({ hasText: "测试关键词" });
  await keywordForm.locator("button.tag-remove").click();
  await page.waitForTimeout(700);
  const keywordDeleted =
    (await page.getByText("#测试关键词", { exact: true }).count()) === 0;

  await page.selectOption("#firstId", { label: "M2 测试 A" });
  await page.selectOption("#secondId", { label: "M2 测试 B" });
  await page.getByRole("button", { name: "融合", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "M2 测试 A × M2 测试 B",
      exact: true,
    })
    .waitFor();

  const cardAAfter = cardByTitle("M2 测试 A");
  const cardBAfter = cardByTitle("M2 测试 B");
  const mergedCard = cardByTitle("M2 测试 A × M2 测试 B");
  const originalAStatus = await cardAAfter.innerText();
  const originalBStatus = await cardBAfter.innerText();
  const mergedText = await mergedCard.innerText();

  await mergedCard.locator('select[name="canvasId"]').selectOption({
    label: "组织创新",
  });
  await mergedCard.getByRole("button", { name: "发送到画布" }).click();
  await page.waitForTimeout(900);

  const healthAfterSend = await (
    await fetch("http://localhost:3000/api/health")
  ).json();

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /画布/ })
    .click();
  await page.waitForURL("**/canvases");
  const canvasText = await page.locator(".workspace-main").innerText();

  await page.screenshot({
    path: "C:\\temp\\opencode\\m2.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        healthBefore,
        autoKeywordText,
        autoKeywordCount,
        keywordDeleted,
        mergedTitleVisible: true,
        originalAStatus: originalAStatus.includes("已融合"),
        originalBStatus: originalBStatus.includes("已融合"),
        mergedText: mergedText.slice(0, 260),
        healthAfterSend,
        nodeCountIncreased:
          healthAfterSend.counts.nodes === healthBefore.counts.nodes + 1,
        canvasText: canvasText.slice(0, 300),
        logs,
      },
      null,
      2,
    ),
  );
} finally {
  const db = new Database("./data/app.db");
  db.pragma("foreign_keys = ON");
  db.prepare("DELETE FROM canvas_nodes WHERE title LIKE ?").run("M2 测试%");
  db.prepare("DELETE FROM inspirations WHERE title LIKE ?").run("M2 测试%");
  db.close();

  await browser.close();
}
