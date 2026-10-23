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
  throw new Error("No Chrome / Edge found.");
}

const db = new Database("./data/app.db");
const canvasId = `result-panel-${Date.now()}`;
const nodeId = `result-panel-node-${Date.now()}`;
const now = Date.now();
db.prepare(
  "insert into canvases (id,name,description,created_at,updated_at) values (?,?,?,?,?)",
).run(canvasId, "结果面板测试", "测试后删除", now, now);
db.prepare(
  `insert into canvas_nodes
   (id, canvas_id, type, role_locked, title, content, weight, color, note, status, x, y, width, height, created_at, updated_at)
   values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
).run(
  nodeId,
  canvasId,
  "result",
  1,
  "结果初稿",
  "旧的测试结论。",
  5,
  "#10b981",
  "",
  "draft",
  180,
  160,
  300,
  220,
  now,
  now,
);
db.close();

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
const logs = [];
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.stack ?? error.message}`);
});

function readState() {
  const read = new Database("./data/app.db", { readonly: true });
  const node = read
    .prepare("select content from canvas_nodes where id = ?")
    .get(nodeId);
  const docs = read
    .prepare("select id, title, content from documents where output_node_id = ?")
    .all(nodeId);
  read.close();
  return { node, docs };
}

let documentId = null;

try {
  await page.goto(`http://localhost:3000/canvases/${canvasId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);

  const outputButton = page
    .locator(".react-flow__node")
    .filter({
      has: page
        .locator(".canvas-node-title")
        .filter({ hasText: /^结果初稿$/ }),
    })
    .getByRole("button", { name: "输出" });
  await outputButton.click();
  await page.locator(".result-panel").waitFor();
  const initialValue = await page.locator(".result-textarea").inputValue();

  await page.locator(".result-textarea").fill("新的结果正文，带一个中间机制。");
  await page.getByRole("button", { name: "保存正文" }).click();
  await page.locator(".result-panel").waitFor({ state: "detached" });
  await page.waitForTimeout(500);
  const afterSave = readState();

  await outputButton.click();
  await page.locator(".result-panel").waitFor();
  await page
    .locator(".result-panel")
    .getByRole("button", { name: "导出为文档" })
    .click();
  await page.locator(".result-panel").waitFor({ state: "detached" });
  await page.waitForTimeout(700);
  const afterExport = readState();
  documentId = afterExport.docs[0]?.id ?? null;

  await page.screenshot({
    path: "C:\\temp\\opencode\\result-panel.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        initialValue,
        savedContent: afterSave.node?.content ?? null,
        documentCount: afterExport.docs.length,
        documentId,
        documentContent: afterExport.docs[0]?.content ?? "",
        logs,
      },
      null,
      2,
    ),
  );
} finally {
  const cleanup = new Database("./data/app.db");
  if (documentId) {
    cleanup.prepare("delete from documents where id = ?").run(documentId);
  }
  cleanup.prepare("delete from canvases where id = ?").run(canvasId);
  cleanup.close();
  await browser.close();
}
