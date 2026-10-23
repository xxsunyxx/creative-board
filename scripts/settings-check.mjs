import { existsSync } from "node:fs";
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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
  await page.goto("http://localhost:3000/settings", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(300);

  const providers = await page
    .locator(".provider-option strong")
    .allInnerTexts();
  const saveBeforeTest = await page
    .getByRole("button", { name: "保存到本机" })
    .isDisabled();

  await page.route("**/api/ai/test", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        provider: "deepseek",
        models: ["deepseek-chat", "deepseek-reasoner"],
        modelCount: 2,
      }),
    });
  });

  await page.getByRole("button", { name: "DeepSeek" }).click();
  await page.locator("#apiKey").fill("sk-mock-1234567890");
  await page.getByRole("button", { name: "测试连接" }).click();
  await page.getByText(/连接成功/).waitFor({ timeout: 10000 });
  const modelEnabledAfterTest = await page.locator("#model").isEnabled();
  const modelOptions = await page.locator("#model option").allInnerTexts();
  await page.locator("#model").selectOption("deepseek-reasoner");
  const saveAfterTest = await page
    .getByRole("button", { name: "保存到本机" })
    .isEnabled();
  await page.getByRole("button", { name: "保存到本机" }).click();
  const savedConfig = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("cb-ai-config") ?? "null"),
  );

  await page.evaluate(() => {
    window.localStorage.setItem(
      "cb-ai-config",
      JSON.stringify({
        provider: "deepseek",
        apiKey: "sk-local-test-1234567890",
        model: "deepseek-chat",
      }),
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  const loadedKey = await page.locator("#apiKey").inputValue();
  const loadedModel = await page.locator("#model").inputValue();
  const deepseekActive = await page
    .locator(".provider-option.is-active strong")
    .innerText();
  const loadedBadge = await page.getByText("已加载本机配置").isVisible();

  await page.getByRole("button", { name: "清除" }).click();
  await page.waitForTimeout(200);
  const cleared = await page.evaluate(
    () => window.localStorage.getItem("cb-ai-config") === null,
  );

  await page.screenshot({
    path: "C:\\temp\\opencode\\settings.png",
    fullPage: true,
  });

  console.log(
    JSON.stringify(
      {
        providers,
        saveBeforeTest,
        modelEnabledAfterTest,
        modelOptions,
        saveAfterTest,
        savedConfig,
        loadedKey,
        loadedModel,
        deepseekActive,
        loadedBadge,
        cleared,
        logs,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
