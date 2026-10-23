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
const canvasId = `dimension-delete-${Date.now()}`;
const aId = `dimension-delete-a-${Date.now()}`;
const bId = `dimension-delete-b-${Date.now()}`;
const edgeId = `dimension-delete-e-${Date.now()}`;
const groupId1 = `dimension-delete-g1-${Date.now()}`;
const groupId2 = `dimension-delete-g2-${Date.now()}`;
const dimId1 = `dimension-delete-d1-${Date.now()}`;
const dimId2 = `dimension-delete-d2-${Date.now()}`;
const now = Date.now();

db.prepare(
  "insert into canvases (id,name,description,created_at,updated_at) values (?,?,?,?,?)",
).run(canvasId, "维度删除测试", "测试后删除", now, now);

for (const [id, title, x] of [
  [aId, "灵感 A", 100],
  [bId, "灵感 B", 560],
]) {
  db.prepare(
    `insert into canvas_nodes
     (id, canvas_id, type, role_locked, title, content, weight, color, note, status, x, y, width, height, created_at, updated_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    canvasId,
    "inspiration",
    1,
    title,
    "测试内容",
    5,
    "#3b82f6",
    "",
    "draft",
    x,
    160,
    280,
    200,
    now,
    now,
  );
}

db.prepare(
  "insert into connections (id, canvas_id, from_node_id, to_node_id, created_at) values (?,?,?,?,?)",
).run(edgeId, canvasId, aId, bId, now);

for (const [groupId, dimId, relation, label] of [
  [groupId1, dimId1, "因果", "机制"],
  [groupId2, dimId2, "条件", "边界条件"],
]) {
  db.prepare(
    "insert into dimension_groups (id, connection_id, relation_type, order_index, attributes, created_at) values (?,?,?,?,?,?)",
  ).run(groupId, edgeId, relation, 0, null, now);
  db.prepare(
    "insert into dimension_nodes (id, group_id, parent_id, label, level, selected, order_index, created_at) values (?,?,?,?,?,?,?,?)",
  ).run(dimId, groupId, null, label, "main", 1, 0, now);
}

db.close();

function readGroupCount() {
  const read = new Database("./data/app.db", { readonly: true });
  const row = read
    .prepare("select count(*) as total from dimension_groups where id in (?,?)")
    .get(groupId1, groupId2);
  read.close();
  return row.total;
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
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
  await page.goto(`http://localhost:3000/canvases/${canvasId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);

  const chipsBefore = await page.locator(".dimension-chip").count();
  const closeButtons = await page.locator(".dimension-chip-close").count();

  const handleSize = await page
    .locator(".canvas-handle")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        width: style.width,
        height: style.height,
        rendered: `${box.width}x${box.height}`,
      };
    });
  await page.locator(".canvas-handle").first().hover();
  await page.waitForTimeout(180);
  const handleSizeHover = await page
    .locator(".canvas-handle")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.width, height: style.height };
    });

  await page.locator(".react-flow__node").first().click();
  await page.waitForTimeout(200);
  const resizeBase = await page
    .locator(".canvas-resize-handle")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.width, height: style.height };
    });
  await page.locator(".canvas-resize-handle").first().hover();
  await page.waitForTimeout(180);
  const resizeHover = await page
    .locator(".canvas-resize-handle")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.width, height: style.height };
    });
  await page.screenshot({
    path: "C:\\temp\\opencode\\handles.png",
    fullPage: true,
  });

  await page.locator(".dimension-chip-wrap").first().hover();
  await page.screenshot({
    path: "C:\\temp\\opencode\\dimension-chip.png",
    fullPage: true,
  });
  await page.locator(".dimension-chip-close").first().click();
  await page.waitForTimeout(700);
  const chipsAfterClose = await page.locator(".dimension-chip").count();
  const groupsAfterClose = readGroupCount();

  await page.locator(".dimension-chip-wrap").first().hover();
  await page.locator(".dimension-chip").first().click();
  await page.waitForTimeout(150);
  const selectedAfterClick = await page
    .locator(".dimension-chip-wrap.is-selected")
    .count();
  await page.keyboard.press("Delete");
  await page.waitForTimeout(700);
  const chipsAfterDelete = await page.locator(".dimension-chip").count();
  const groupsAfterDelete = readGroupCount();

  await page.screenshot({
    path: "C:\\temp\\opencode\\dimension-delete.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        chipsBefore,
        closeButtons,
        handleSize,
        handleSizeHover,
        resizeBase,
        resizeHover,
        chipsAfterClose,
        groupsAfterClose,
        selectedAfterClick,
        chipsAfterDelete,
        groupsAfterDelete,
        logs,
      },
      null,
      2,
    ),
  );
} finally {
  const cleanup = new Database("./data/app.db");
  cleanup.prepare("delete from canvases where id = ?").run(canvasId);
  cleanup.close();
  await browser.close();
}
