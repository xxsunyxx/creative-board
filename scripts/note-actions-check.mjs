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
const canvasId = `note-actions-${Date.now()}`;
const aId = `note-actions-a-${Date.now()}`;
const bId = `note-actions-b-${Date.now()}`;
const edgeId = `note-actions-e-${Date.now()}`;
const groupId = `note-actions-g-${Date.now()}`;
const dimId = `note-actions-d-${Date.now()}`;
const createdAt = Date.now();
let savedInspirationId = null;
let exportedDocumentId = null;

db.prepare(
  "insert into canvases (id,name,description,created_at,updated_at) values (?,?,?,?,?)",
).run(canvasId, "便签动作测试", "测试后删除", createdAt, createdAt);

for (const [id, title, content, role, x] of [
  [aId, "导出测试", "这是一段完整的导出测试内容。", "inspiration", 100],
  [bId, "关联结果", "", "result", 560],
]) {
  db.prepare(
    `insert into canvas_nodes
     (id, canvas_id, type, role_locked, title, content, weight, color, note, status, x, y, width, height, created_at, updated_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    canvasId,
    role,
    1,
    title,
    content,
    5,
    role === "result" ? "#10b981" : "#3b82f6",
    "",
    "draft",
    x,
    180,
    280,
    200,
    createdAt,
    createdAt,
  );
}

db.prepare(
  "insert into connections (id, canvas_id, from_node_id, to_node_id, created_at) values (?,?,?,?,?)",
).run(edgeId, canvasId, aId, bId, createdAt);
db.prepare(
  "insert into dimension_groups (id, connection_id, relation_type, order_index, attributes, created_at) values (?,?,?,?,?,?)",
).run(groupId, edgeId, "因果", 0, null, createdAt);
db.prepare(
  "insert into dimension_nodes (id, group_id, parent_id, label, level, selected, order_index, created_at) values (?,?,?,?,?,?,?,?)",
).run(dimId, groupId, null, "机制", "main", 1, 0, createdAt);
db.close();

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const logs = [];
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.stack ?? error.message}`);
});

function readDb() {
  const read = new Database("./data/app.db", { readonly: true });
  const inspiration = read
    .prepare(
      "select id, title, content from inspirations where title = ? and content = ?",
    )
    .get("导出测试", "这是一段完整的导出测试内容。");
  const documents = read
    .prepare("select id, title, content from documents where title = ?")
    .all("导出测试");
  const node = read
    .prepare("select content from canvas_nodes where id = ?")
    .get(aId);
  const inspirationCount = read
    .prepare("select count(*) as total from inspirations")
    .get().total;
  read.close();
  return { inspiration, documents, node, inspirationCount };
}

try {
  await page.goto(`http://localhost:3000/canvases/${canvasId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);

  const iconCount = await page.locator(".node-icon-button").count();
  const note = page
    .locator(".react-flow__node")
    .filter({
      has: page
        .locator(".canvas-node-title")
        .filter({ hasText: /^导出测试$/ }),
    })
    .first();

  await page.screenshot({
    path: "C:\\temp\\opencode\\note-actions.png",
    fullPage: true,
  });

  await note.getByRole("button", { name: "存入灵感库" }).click();
  await page.getByText(/已存入灵感库|灵感库已有/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const afterSave = readDb();
  savedInspirationId = afterSave.inspiration?.id ?? null;

  await note.getByRole("button", { name: "存入灵感库" }).click();
  await page.waitForTimeout(500);
  const afterSaveAgain = readDb();

  await note.getByRole("button", { name: "导出为文档" }).click();
  await page.getByText(/文档已生成/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const afterExport = readDb();
  exportedDocumentId = afterExport.documents[0]?.id ?? null;

  const beforeInference = readDb().inspirationCount;
  await page.locator(".canvas-infer").click();
  await page.waitForTimeout(900);
  const afterInference = readDb().inspirationCount;

  page.once("dialog", (dialog) => void dialog.accept());
  await note.getByRole("button", { name: "清空正文" }).click();
  await page.waitForTimeout(700);
  const afterClear = readDb();

  console.log(
    JSON.stringify(
      {
        iconCount,
        afterSave: Boolean(afterSave.inspiration),
        savedInspirationId,
        afterSaveAgainDocumentCount: afterSaveAgain.documents.length,
        inspirationCountAfterSecondSave: afterSaveAgain.inspirationCount,
        exportedDocumentId,
        exportDocumentCount: afterExport.documents.length,
        exportContent: afterExport.documents[0]?.content ?? "",
        beforeInference,
        afterInference,
        autoSavedToInspiration: afterInference !== beforeInference,
        clearedContent: afterClear.node?.content ?? null,
        logs,
      },
      null,
      2,
    ),
  );
} finally {
  const cleanup = new Database("./data/app.db");
  if (exportedDocumentId) {
    cleanup
      .prepare("delete from documents where id = ?")
      .run(exportedDocumentId);
  }
  cleanup.prepare("delete from documents where title = ?").run("导出测试");
  if (savedInspirationId) {
    cleanup
      .prepare("delete from inspirations where id = ?")
      .run(savedInspirationId);
  }
  cleanup.prepare("delete from canvases where id = ?").run(canvasId);
  cleanup.close();
  await browser.close();
}
