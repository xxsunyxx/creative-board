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

function readStats(canvasId) {
  const db = new Database("./data/app.db", { readonly: true });
  const stats = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM connections WHERE canvas_id = ?) AS connections,
        (SELECT COUNT(*) FROM dimension_groups g
          JOIN connections c ON c.id = g.connection_id
          WHERE c.canvas_id = ?) AS groups,
        (SELECT COUNT(*) FROM dimension_nodes n
          JOIN dimension_groups g ON g.id = n.group_id
          JOIN connections c ON c.id = g.connection_id
          WHERE c.canvas_id = ?) AS nodes,
        (SELECT COUNT(*) FROM dimension_nodes n
          JOIN dimension_groups g ON g.id = n.group_id
          JOIN connections c ON c.id = g.connection_id
          WHERE c.canvas_id = ? AND n.selected = 1) AS selected,
        (SELECT COUNT(*) FROM dimension_nodes n
          JOIN dimension_groups g ON g.id = n.group_id
          JOIN connections c ON c.id = g.connection_id
          WHERE c.canvas_id = ? AND n.level = 'deeper') AS deeper`,
    )
    .get(canvasId, canvasId, canvasId, canvasId, canvasId);
  db.close();
  return stats;
}

function readPositions(canvasId) {
  const db = new Database("./data/app.db", { readonly: true });
  const rows = db
    .prepare(
      `SELECT id, x, y FROM canvas_nodes
       WHERE canvas_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC`,
    )
    .all(canvasId);
  db.close();
  return rows;
}

async function connectNodes(sourceTitle, targetTitle) {
  const sourceNode = page
    .locator(".react-flow__node")
    .filter({ hasText: sourceTitle })
    .first();
  const targetNode = page
    .locator(".react-flow__node")
    .filter({ hasText: targetTitle })
    .first();
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

try {
  await page.goto("http://localhost:3000/canvases", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(300);

  await page.fill("#name", "M4 测试画布");
  await page.fill("#description", "M4 测试后删除");
  await page.getByRole("button", { name: "新建画布" }).click();
  await page
    .getByRole("link", { name: "M4 测试画布", exact: true })
    .waitFor();

  for (const title of ["远程办公", "团队创新", "AI 协作工具"]) {
    await page
      .locator(".workspace-nav")
      .getByRole("link", { name: /灵感库/ })
      .click();
    await page.waitForURL("**/inspirations");
    const card = page.locator(".inspiration-card").filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
    await card
      .locator('select[name="canvasId"]')
      .selectOption({ label: "M4 测试画布" });
    await card.getByRole("button", { name: "发送到画布" }).click();
    await page.waitForTimeout(550);
  }

  const db0 = new Database("./data/app.db", { readonly: true });
  const testCanvas = db0
    .prepare("SELECT id FROM canvases WHERE name = ?")
    .get("M4 测试画布");
  db0.close();
  if (!testCanvas) throw new Error("test canvas missing");

  await page
    .locator(".workspace-nav")
    .getByRole("link", { name: /画布/ })
    .click();
  await page.waitForURL("**/canvases");
  await page
    .getByRole("link", { name: "M4 测试画布", exact: true })
    .click();
  await page.waitForURL(/\/canvases\/[^/]+$/);
  await page.waitForSelector(".react-flow__node", { timeout: 10000 });
  await page.waitForTimeout(500);

  const nodeCount = await page.locator(".react-flow__node").count();

  await connectNodes("远程办公", "团队创新");
  const recommendedCount = await page.locator(".relation-card").count();
  const fixedCount = await page.locator(".relation-chip").count();
  await page
    .locator(".relation-card")
    .filter({ hasText: "因果" })
    .first()
    .click();
  await page.locator(".dimension-chip").first().waitFor();
  await page.waitForTimeout(400);

  const firstChip = page.locator(".dimension-chip").first();
  const firstChipBefore = await firstChip.innerText();
  await firstChip.click();
  await page.locator(".dimension-popover").waitFor();
  const mainCount = await page.locator(".dim-tree > .dim-branch").count();
  const treeText = await page.locator(".dim-tree").innerText();

  await page
    .locator(".dim-tree .dim-label")
    .filter({ hasText: /^触发器$/ })
    .first()
    .click();
  await page.waitForTimeout(500);
  const firstChipAfter = await firstChip.innerText();
  await page.locator(".icon-button").first().click();

  await page.locator(".edge-add").first().click();
  await page.locator(".relationship-modal").waitFor();
  await page.getByRole("button", { name: "约束", exact: true }).click();
  await page.waitForTimeout(600);
  const chipsAfterSecondGroup = await page.locator(".dimension-chip").count();

  const statsAfterSecondGroup = readStats(testCanvas.id);
  const firstChipText = await page.locator(".dimension-chip").first().innerText();

  await connectNodes("远程办公", "AI 协作工具");
  await page
    .locator(".relation-card")
    .filter({ hasText: "类比" })
    .first()
    .click();
  await page.waitForTimeout(700);
  const edgeCount = await page.locator(".react-flow__edge").count();
  const endpointCount = await page.locator(".edge-endpoint").count();
  const statsAfterBranch = readStats(testCanvas.id);

  await page.getByRole("button", { name: "自动排布" }).click();
  await page.waitForTimeout(900);
  const positionsAfterLayout = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".react-flow__node")).map((node) => ({
      id: node.getAttribute("data-id"),
      transform: node.getAttribute("style"),
    })),
  );
  const dbPositionsAfterLayout = readPositions(testCanvas.id);

  const defaultFocusMode =
    (await page.locator(".workspace.is-focus").count()) === 1;

  await page.getByRole("button", { name: "退出全屏" }).click();
  await page.waitForTimeout(300);
  await page.locator(".sidebar-toggle").click();
  await page.waitForTimeout(300);
  const sidebarCollapsed =
    (await page.locator(".sidebar.is-collapsed").count()) === 1;
  await page.locator(".sidebar-toggle").click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "全屏" }).click();
  await page.waitForTimeout(400);
  const focusMode =
    (await page.locator(".workspace.is-focus").count()) === 1;
  await page.screenshot({
    path: "C:\\temp\\opencode\\m4-focus.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "退出全屏" }).click();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: "C:\\temp\\opencode\\m4.png",
    fullPage: true,
  });

  await page.locator(".dimension-chip").first().click();
  await page.locator(".dimension-popover").waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除整条连接" }).click();
  await page.waitForTimeout(700);
  const statsAfterDelete = readStats(testCanvas.id);

  console.log(
    JSON.stringify(
      {
        nodeCount,
        recommendedCount,
        fixedCount,
        firstChipBefore,
        firstChipAfter,
        mainCount,
        treeText: treeText.slice(0, 300),
        chipsAfterSecondGroup,
        firstChipText,
        statsAfterSecondGroup,
        edgeCount,
        endpointCount,
        statsAfterBranch,
        positionsAfterLayout,
        dbPositionsAfterLayout,
        defaultFocusMode,
        sidebarCollapsed,
        focusMode,
        statsAfterDelete,
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
    .get("M4 测试画布");
  if (canvas) {
    db.prepare("DELETE FROM canvases WHERE id = ?").run(canvas.id);
  }
  db.close();

  await browser.close();
}
