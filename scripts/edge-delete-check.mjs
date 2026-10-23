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
const canvasId = `edge-delete-${Date.now()}`;
const aId = `edge-delete-a-${Date.now()}`;
const bId = `edge-delete-b-${Date.now()}`;
const edgeId = `edge-delete-e-${Date.now()}`;
const now = Date.now();

db.prepare(
  "insert into canvases (id,name,description,created_at,updated_at) values (?,?,?,?,?)",
).run(canvasId, "Del 删连线测试", "测试后删除", now, now);

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
db.close();

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

function readEdgeCount() {
  const read = new Database("./data/app.db", { readonly: true });
  const row = read
    .prepare("select count(*) as total from connections where canvas_id = ?")
    .get(canvasId);
  read.close();
  return row.total;
}

try {
  await page.goto(`http://localhost:3000/canvases/${canvasId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);

  const edgeBefore = await page.locator(".react-flow__edge").count();
  const interactionCount = await page
    .locator(".react-flow__edge-interaction")
    .count();

  console.log(
    JSON.stringify({
      edgeBefore,
      interactionCount,
      nodeCount: await page.locator(".react-flow__node").count(),
      logs,
    }),
  );

  if (edgeBefore === 0) {
    await page.screenshot({
      path: "C:\\temp\\opencode\\edge-delete.png",
      fullPage: true,
    });
    throw new Error("edge missing");
  }

  if (interactionCount > 0) {
    await page.locator(".react-flow__edge-interaction").first().dispatchEvent("click");
  } else {
    await page.locator(".dimension-edge-path").first().dispatchEvent("click");
  }

  await page.waitForTimeout(250);
  const selectedBefore = await page.locator(".react-flow__edge.selected").count();
  await page.keyboard.press("Delete");
  await page.waitForTimeout(700);

  const edgeAfter = await page.locator(".react-flow__edge").count();
  const dbEdgesAfter = readEdgeCount();

  console.log(
    JSON.stringify(
      {
        edgeBefore,
        interactionCount,
        selectedBefore,
        edgeAfter,
        dbEdgesAfter,
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
