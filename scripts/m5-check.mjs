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

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const logs = [];

page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.stack ?? error.message}`);
});

function readState(canvasId) {
  const db = new Database("./data/app.db", { readonly: true });
  const nodes = db
    .prepare(
      `SELECT id, type, title, content, role_locked
       FROM canvas_nodes
       WHERE canvas_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC`,
    )
    .all(canvasId);
  const edges = db
    .prepare(
      `SELECT id, from_node_id, to_node_id
       FROM connections WHERE canvas_id = ?`,
    )
    .all(canvasId);
  const groups = db
    .prepare(
      `SELECT g.id, g.connection_id, g.relation_type
       FROM dimension_groups g
       JOIN connections c ON c.id = g.connection_id
       WHERE c.canvas_id = ?`,
    )
    .all(canvasId);
  const selected = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM dimension_nodes n
       JOIN dimension_groups g ON g.id = n.group_id
       JOIN connections c ON c.id = g.connection_id
       WHERE c.canvas_id = ? AND n.selected = 1`,
    )
    .get(canvasId).total;
  db.close();
  return { nodes, edges, groups, selected };
}

async function connect(sourceNode, targetNode) {
  const sourceHandle = sourceNode.locator(".react-flow__handle-right");
  const targetHandle = targetNode.locator(".react-flow__handle-left");
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("connection handle box missing");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 18 },
  );
  await page.mouse.up();
  await page.locator(".relationship-modal").waitFor({ timeout: 6000 });
}

async function pickRelation(label) {
  await page
    .locator(".relation-card, .relation-chip")
    .filter({ hasText: label })
    .first()
    .click();
  await page.locator(".relationship-modal").waitFor({ state: "detached" });
  await page.waitForTimeout(400);
}

try {
  await page.goto("http://localhost:3000/canvases", {
    waitUntil: "networkidle",
  });
  await page.fill("#name", "M5 测试画布");
  await page.fill("#description", "M5 测试后删除");
  await page.getByRole("button", { name: "新建画布" }).click();
  await page
    .getByRole("link", { name: "M5 测试画布", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "M5 测试画布", exact: true })
    .click();
  await page.waitForURL(/\/canvases\/[^/]+$/);
  await page.waitForTimeout(400);

  const canvasUrl = page.url();
  const db0 = new Database("./data/app.db", { readonly: true });
  const canvas = db0
    .prepare("SELECT id FROM canvases WHERE name = ?")
    .get("M5 测试画布");
  db0.close();
  if (!canvas) throw new Error("test canvas missing");

  for (const role of ["inspiration", "inspiration", "result"]) {
    await page.locator(".canvas-insert-select").selectOption(role);
    await page.locator(".canvas-tool").filter({ hasText: "插入" }).click();
    await page.waitForTimeout(350);
  }

  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "自动排布" }).click();
  await page.waitForTimeout(700);

  const insertionState = readState(canvas.id);
  const nodeCountAfterInsert = await page.locator(".react-flow__node").count();
  const resultNodeId = insertionState.nodes.find(
    (node) => node.type === "result",
  )?.id;

  const inspirations = page
    .locator(".react-flow__node")
    .filter({
      has: page
        .locator(".canvas-node-title")
        .filter({ hasText: /^空灵感$/ }),
    });
  const resultNode = page
    .locator(".react-flow__node")
    .filter({
      has: page
        .locator(".canvas-node-title")
        .filter({ hasText: /^空结果$/ }),
    })
    .first();

  await connect(inspirations.nth(0), resultNode);
  await pickRelation("因果");
  await connect(inspirations.nth(1), resultNode);
  await pickRelation("条件");

  const connectedState = readState(canvas.id);
  const edgesAfterConnect = await page.locator(".react-flow__edge").count();

  await page.locator(".canvas-infer").click();
  await page
    .locator(".canvas-infer-status")
    .filter({ hasText: "已推理" })
    .waitFor({ timeout: 6000 });
  await page.waitForTimeout(500);

  const inferredState = readState(canvas.id);
  const contentsAfterInfer = await page
    .locator(".canvas-node-content")
    .allInnerTexts();

  await page.locator(".dimension-chip").first().click();
  await page.locator(".dimension-popover").waitFor();
  await page.getByRole("button", { name: "插入过程节点" }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "自动排布" }).click();
  await page.waitForTimeout(900);

  const afterSplitState = readState(canvas.id);
  const processNodeId = afterSplitState.nodes.find(
    (node) => node.type === "process",
  )?.id;
  const nodeCountAfterSplit = await page.locator(".react-flow__node").count();
  const edgeCountAfterSplit = await page.locator(".react-flow__edge").count();
  const processNode = page
    .locator(".react-flow__node")
    .filter({
      has: page
        .locator(".canvas-node-title")
        .filter({ hasText: /^过程$/ }),
    })
    .first();
  const processRole = await processNode
    .locator(".note-role-select")
    .inputValue();

  await page.locator(".canvas-infer").click();
  await page.waitForTimeout(900);
  const afterProcessInfer = readState(canvas.id);
  const processContent = afterProcessInfer.nodes.find(
    (node) => node.type === "process",
  )?.content;

  await processNode
    .locator(".note-role-select")
    .selectOption("result");
  await page.waitForTimeout(700);
  const afterRoleChange = readState(canvas.id);
  const processTypeAfterChange = afterRoleChange.nodes.find(
    (node) => node.id === processNodeId,
  )?.type;

  await page.locator(".dimension-chip").first().click();
  await page.locator(".dimension-popover").waitFor();
  await page.getByRole("button", { name: /Lucky/ }).click();
  await page.waitForTimeout(700);
  const afterLucky = readState(canvas.id);

  const resultNodeById = page.locator(
    `.react-flow__node[data-id="${resultNodeId}"]`,
  );
  await resultNodeById
    .locator(".node-note-button")
    .filter({ hasText: "编辑" })
    .click();
  await page.locator(".content-textarea").fill("M5 测试正文");
  await page.getByRole("button", { name: "保存正文" }).click();
  await page.waitForTimeout(700);
  const afterContentEdit = readState(canvas.id);
  const editedContent = afterContentEdit.nodes.find(
    (node) => node.id === resultNodeId,
  )?.content;

  await page.screenshot({
    path: "C:\\temp\\opencode\\m5.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        canvasUrl,
        nodeCountAfterInsert,
        insertionState,
        edgesAfterConnect,
        connectedState,
        inferredState,
        contentsAfterInfer,
        nodeCountAfterSplit,
        edgeCountAfterSplit,
        afterSplitState,
        processRole,
        processContent,
        processTypeAfterChange,
        afterLuckySelected: afterLucky.selected,
        editedContent,
        logs,
      },
      null,
      2,
    ),
  );
} finally {
  const db = new Database("./data/app.db");
  db.pragma("foreign_keys = ON");
  const canvas = db
    .prepare("SELECT id FROM canvases WHERE name = ?")
    .get("M5 测试画布");
  if (canvas) {
    db.prepare("DELETE FROM canvases WHERE id = ?").run(canvas.id);
  }
  db.close();

  await browser.close();
}
