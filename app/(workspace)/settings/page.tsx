import { AiSettingsForm } from "@/components/ai-settings-form";

export default function SettingsPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="page-kicker">Settings</p>
          <h1 className="page-title">AI 设置</h1>
          <p className="page-subtitle">
            接入 OpenAI / Claude / DeepSeek。Key 只保存在本机浏览器，不写入数据库。
          </p>
        </div>
      </header>

      <AiSettingsForm />
    </>
  );
}
