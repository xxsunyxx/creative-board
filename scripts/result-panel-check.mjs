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
const aId = `result-panel-a-${Date.now()}`;
const bId = `result-panel-b-${Date.now()}`;
const edgeA = `result-panel-ea-${Date.now()}`;
const edgeB = `result-panel-eb-${Date.now()}`;
const groupId = `result-panel-g-${Date.now()}`;
const dimId = `result-panel-d-${Date.now()}`;
const now = Date.now();
db.prepare(
  "insert into canvases (id,name,description,created_at,updated_at) values (?,?,?,?,?)",
).run(canvasId, "结果面板测试", "测试后删除", now, now);

for (const [id, title, content, x] of [
  [aId, "团队创新", "需要高频碰撞、心理安全和非正式交流。", 60],
  [bId, "远程办公", "降低协调成本，但异步沟通增加。", 60],
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
    content,
    7,
    "#3b82f6",
    "",
    "draft",
    x,
    60 + (id === bId ? 0 : 260),
    280,
    200,
    now,
    now,
  );
}

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
  560,
  160,
  300,
  220,
  now,
  now,
);

for (const [id, source] of [
  [edgeA, aId],
  [edgeB, bId],
]) {
  db.prepare(
    "insert into connections (id, canvas_id, from_node_id, to_node_id, created_at) values (?,?,?,?,?)",
  ).run(id, canvasId, source, nodeId, now);
}
db.prepare(
  "insert into dimension_groups (id, connection_id, relation_type, order_index, attributes, created_at) values (?,?,?,?,?,?)",
).run(groupId, edgeA, "因果", 0, null, now);
db.prepare(
  "insert into dimension_nodes (id, group_id, parent_id, label, level, selected, order_index, created_at) values (?,?,?,?,?,?,?,?)",
).run(dimId, groupId, null, "机制", "main", 1, 0, now);
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
    .prepare("select title, content, selected_question from canvas_nodes where id = ?")
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

  await page
    .locator(".result-panel")
    .getByRole("button", { name: "生成候选问题" })
    .click();
  await page.locator(".result-question").first().waitFor({ timeout: 10000 });
  const questionCount = await page.locator(".result-question").count();
  await page.locator(".result-question").first().click();
  await page.waitForTimeout(600);
  const questionState = readState();
  const selectedQuestion = await page
    .locator(".result-selected-question")
    .innerText();

  await page
    .locator(".result-panel")
    .getByRole("button", { name: "生成结果" })
    .click();
  await page.locator(".result-answer-message").waitFor({ timeout: 10000 });
  const generatedAnswer = await page.locator(".result-textarea").inputValue();

  await page.locator(".result-textarea").fill("新的结果正文，带一个中间机制。");
  await page.getByRole("button", { name: "保存正文" }).click();
  await page.locator(".result-panel").waitFor({ state: "detached" });
  await page.waitForTimeout(500);
  const afterSave = readState();

  await outputButton.click();
  await page.locator(".result-panel").waitFor();
  await page
    .locator(".result-panel")
    .getByRole("button", { name: "生成完整文档" })
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
        questionCount,
        selectedQuestion,
        selectedQuestionInDb: questionState.node?.selected_question ?? null,
        generatedAnswer,
        generatedAnswerLength: generatedAnswer.length,
        savedContent: afterSave.node?.content ?? null,
        savedQuestion: afterSave.node?.selected_question ?? null,
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
