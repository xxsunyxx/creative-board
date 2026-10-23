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
const canvasId = `engine-check-${Date.now()}`;
const now = Date.now();
const nodes = [
  {
    id: `engine-check-a-${Date.now()}`,
    role: "inspiration",
    title: "空灵感 A",
    x: 80,
    y: 120,
  },
  {
    id: `engine-check-b-${Date.now()}`,
    role: "inspiration",
    title: "空灵感 B",
    x: 80,
    y: 380,
  },
  {
    id: `engine-check-r-${Date.now()}`,
    role: "result",
    title: "空结果",
    x: 480,
    y: 250,
  },
];
const edges = [
  {
    id: `engine-check-e1-${Date.now()}`,
    source: nodes[0].id,
    target: nodes[2].id,
  },
  {
    id: `engine-check-e2-${Date.now()}`,
    source: nodes[1].id,
    target: nodes[2].id,
  },
];

db.prepare(
  "insert into canvases (id,name,description,created_at,updated_at) values (?,?,?,?,?)",
).run(canvasId, "Engine 测试画布", "引擎测试后删除", now, now);

for (const node of nodes) {
  db.prepare(
    `insert into canvas_nodes
     (id, canvas_id, type, role_locked, title, content, weight, color, note, status, x, y, width, height, created_at, updated_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    node.id,
    canvasId,
    node.role,
    1,
    node.title,
    "",
    5,
    node.role === "result" ? "#10b981" : "#3b82f6",
    "",
    "draft",
    node.x,
    node.y,
    280,
    200,
    now,
    now,
  );
}

for (const edge of edges) {
  db.prepare(
    "insert into connections (id, canvas_id, from_node_id, to_node_id, created_at) values (?,?,?,?,?)",
  ).run(edge.id, canvasId, edge.source, edge.target, now);
}

db.close();

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const logs = [];

page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.stack ?? error.message}`);
});

function readEngineState() {
  const read = new Database("./data/app.db", { readonly: true });
  const canvasNodes = read
    .prepare(
      "select id, type, title, content from canvas_nodes where canvas_id = ?",
    )
    .all(canvasId);
  const runs = read
    .prepare("select id, status, provider, model, error from inference_runs where canvas_id = ?")
    .all(canvasId);
  const patches = read
    .prepare(
      `select p.id, p.node_id, p.undone_at
       from inference_patches p
       join inference_runs r on r.id = p.run_id
       where r.canvas_id = ?`,
    )
    .all(canvasId);
  const usage = read
    .prepare(
      `select provider, model, input_tokens, output_tokens, total_tokens
       from ai_usage where canvas_id = ?`,
    )
    .all(canvasId);
  read.close();
  return { canvasNodes, runs, patches, usage };
}

try {
  await page.goto(`http://localhost:3000/canvases/${canvasId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);

  await page.locator(".canvas-infer").click();
  await page
    .locator(".canvas-infer-status")
    .filter({ hasText: "已推理" })
    .waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);

  const afterInfer = readEngineState();
  const contentAfterInfer = await page
    .locator(".canvas-node-content")
    .allInnerTexts();

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const undoVisibleAfterReload = await page
    .getByRole("button", { name: "撤销" })
    .isVisible();

  await page.getByRole("button", { name: "撤销" }).click();
  await page
    .locator(".canvas-infer-status")
    .filter({ hasText: "已撤销" })
    .waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);

  const afterUndo = readEngineState();
  const contentAfterUndo = await page
    .locator(".canvas-node-content")
    .allInnerTexts();

  await page.screenshot({
    path: "C:\\temp\\opencode\\engine.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        afterInfer,
        contentAfterInfer,
        undoVisibleAfterReload,
        afterUndo,
        contentAfterUndo,
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
