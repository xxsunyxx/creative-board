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

function readNode() {
  const db = new Database("./data/app.db", { readonly: true });
  const canvas = db
    .prepare("SELECT id FROM canvases WHERE name = ?")
    .get("M3 测试画布");
  const node = canvas
    ? db
        .prepare(
          `SELECT id, x, y, weight, color, note, deleted_at
           FROM canvas_nodes
           WHERE canvas_id = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(canvas.id)
    : null;
  const noteCount =
    node === null
      ? 0
      : db
          .prepare(
            `SELECT COUNT(*) AS total
             FROM inspiration_notes
             WHERE sticky_note_id = ? AND content LIKE 'M3 测试备注%'`,
          )
          .get(node.id).total;
  db.close();
  return { canvasId: canvas?.id ?? null, node, noteCount };
}

try {
  await page.goto("http://localhost:3000/canvases", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(300);

  await page.fill("#name", "M3 测试画布");
  await page.fill("#description", "M3 测试后删除");
  await page.getByRole("button", { name: "新建画布" }).click();
  await page
    .getByRole("link", { name: "M3 测试画布", exact: true })
    .waitFor();

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /灵感库/ })
    .click();
  await page.waitForURL("**/inspirations");

  const sourceCard = page.locator(".inspiration-card").filter({
    has: page.getByRole("heading", { name: "远程办公", exact: true }),
  });
  await sourceCard
    .locator('select[name="canvasId"]')
    .selectOption({ label: "M3 测试画布" });
  await sourceCard.getByRole("button", { name: "发送到画布" }).click();
  await page.waitForTimeout(900);

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /画布/ })
    .click();
  await page.waitForURL("**/canvases");
  await page
    .getByRole("link", { name: "M3 测试画布", exact: true })
    .click();
  await page.waitForURL(/\/canvases\/[^/]+$/);
  await page.waitForSelector(".canvas-node", { timeout: 10000 });
  await page.waitForTimeout(400);

  const initial = readNode();
  const nodeCount = await page.locator(".canvas-node").count();

  const node = page.locator(".canvas-node").first();
  const box = await node.boundingBox();
  if (!box) throw new Error("canvas node box missing");
  await page.mouse.move(box.x + 100, box.y + 18);
  await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 70, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const afterDrag = readNode();

  await page.locator(".canvas-weight").fill("9");
  await page.locator(".canvas-weight").press("Enter");
  await page.waitForTimeout(600);
  const afterWeight = readNode();

  await page.locator(".canvas-color-button").click();
  await page.getByRole("button", { name: "颜色 #ef4444" }).click();
  await page.waitForTimeout(600);
  const afterColor = readNode();

  await page.locator(".node-note-button").click();
  await page.locator(".note-textarea").fill("M3 测试备注 1");
  await page.getByRole("button", { name: "保存备注" }).click();
  await page.waitForSelector(".note-editor", { state: "detached" });
  await page.waitForTimeout(600);
  const afterNote = readNode();
  const noteButtonText = await page.locator(".node-note-button").innerText();

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /灵感库/ })
    .click();
  await page.waitForURL("**/inspirations");
  const sourceNoteCard = page.locator(".inspiration-card").filter({
    has: page.getByRole("heading", { name: "远程办公", exact: true }),
  });
  const noteSummary = sourceNoteCard.locator(".note-history summary");
  const syncedNoteSummaryVisible = await noteSummary.isVisible();
  await noteSummary.click();
  const syncedNoteVisible = await sourceNoteCard
    .getByText("M3 测试备注 1", { exact: true })
    .isVisible();

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /画布/ })
    .click();
  await page.waitForURL("**/canvases");
  await page
    .getByRole("link", { name: "M3 测试画布", exact: true })
    .click();
  await page.waitForURL(/\/canvases\/[^/]+$/);
  await page.waitForSelector(".canvas-node", { timeout: 10000 });
  await page.waitForTimeout(400);

  await page.screenshot({
    path: "C:\\temp\\opencode\\m3.png",
    fullPage: true,
  });

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".node-delete").click();
  await page.waitForTimeout(900);
  const afterDelete = readNode();
  const nodesAfterDelete = await page.locator(".canvas-node").count();

  console.log(
    JSON.stringify(
      {
        nodeCount,
        initial,
        afterDrag,
        afterWeight,
        afterColor,
        afterNote,
        noteButtonText,
        syncedNoteSummaryVisible,
        syncedNoteVisible,
        afterDelete,
        nodesAfterDelete,
        positionSaved:
          afterDrag.node.x !== initial.node.x ||
          afterDrag.node.y !== initial.node.y,
        weightSaved: afterWeight.node.weight === 9,
        colorSaved: afterColor.node.color === "#ef4444",
        noteSaved:
          afterNote.node.note === "M3 测试备注 1" &&
          afterNote.noteCount === 1,
        deleteSaved: afterDelete.node?.deleted_at !== null,
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
    .get("M3 测试画布");
  if (canvas) {
    db.prepare("DELETE FROM canvases WHERE id = ?").run(canvas.id);
  }
  db.prepare(
    "DELETE FROM inspiration_notes WHERE content LIKE 'M3 测试备注%'",
  ).run();
  db.close();

  await browser.close();
}
