"use client";

import { useEffect, useState } from "react";
import {
  AI_CONFIG_STORAGE_KEY,
  AI_PROVIDERS,
  type AiConfig,
  type AiProvider,
} from "@/lib/ai/providers";

type TestState = "idle" | "testing" | "success" | "error";

export function AiSettingsForm() {
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [testState, setTestState] = useState<TestState>("idle");
  const [message, setMessage] = useState("");
  const [testedFor, setTestedFor] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const stored = JSON.parse(raw) as Partial<AiConfig>;
      if (
        stored.provider &&
        AI_PROVIDERS.some((item) => item.id === stored.provider)
      ) {
        setProvider(stored.provider);
      }
      if (typeof stored.apiKey === "string") {
        setApiKey(stored.apiKey);
      }
      if (typeof stored.model === "string") {
        setModel(stored.model);
      }
      setLoaded(true);
      setSaved(true);
      setMessage("已从本机浏览器加载");
    } catch {
      window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
    }
  }, []);

  const credential = `${provider}:${apiKey.trim()}`;
  const canTest = apiKey.trim().length >= 10 && testState !== "testing";
  const canSave =
    testState === "success" &&
    testedFor === credential &&
    apiKey.trim().length >= 10 &&
    model.length > 0;

  const resetTest = (nextProvider: AiProvider, nextKey: string) => {
    setProvider(nextProvider);
    setApiKey(nextKey);
    setModels([]);
    setModel("");
    setTestState("idle");
    setMessage("");
    setSaved(false);
  };

  const handleTest = async () => {
    setTestState("testing");
    setMessage("正在连接…");

    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        models?: string[];
      };

      if (!response.ok || !result.ok) {
        setTestState("error");
        setMessage(result.error ?? "测试失败");
        setTestedFor("");
        return;
      }

      const nextModels = Array.isArray(result.models)
        ? result.models.filter((item) => typeof item === "string")
        : [];
      setModels(nextModels);
      const nextModel =
        nextModels.length > 0
          ? nextModels.includes(model)
            ? model
            : nextModels[0]
          : model;
      setModel(nextModel);
      setTestState("success");
      setTestedFor(credential);
      setMessage(
        nextModels.length > 0
          ? `连接成功，可用模型 ${nextModels.length} 个，请选择模型后保存`
          : "连接成功，但没有拿到模型列表",
      );
    } catch (error) {
      setTestState("error");
      setMessage(error instanceof Error ? error.message : "测试失败");
      setTestedFor("");
    }
  };

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    window.localStorage.setItem(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ provider, apiKey: apiKey.trim(), model }),
    );
    setSaved(true);
    setMessage("已保存到本机浏览器，不会写入数据库或服务端");
  };

  const handleClear = () => {
    window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
    setProvider("openai");
    setApiKey("");
    setModels([]);
    setModel("");
    setTestState("idle");
    setTestedFor("");
    setMessage("已清除本机配置");
    setLoaded(false);
    setSaved(false);
  };

  return (
    <div className="settings-grid">
      <section className="settings-card">
        <div className="panel-head">
          <div>
            <h2>AI Provider</h2>
            <p>先选服务商、粘贴 API key；测试连接后从模型列表选模型，再保存。</p>
          </div>
          {loaded ? <span className="mock-badge">已加载本机配置</span> : null}
        </div>

        <div className="provider-grid">
          {AI_PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`provider-option ${
                provider === item.id ? "is-active" : ""
              }`}
              onClick={() => resetTest(item.id, apiKey)}
            >
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        <div className="settings-field">
          <label htmlFor="apiKey">API key</label>
          <div className="key-row">
            <input
              id="apiKey"
              className="input"
              type={showKey ? "text" : "password"}
              value={apiKey}
              placeholder={
                AI_PROVIDERS.find((item) => item.id === provider)?.keyHint ??
                "粘贴 API key"
              }
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => resetTest(provider, event.target.value)}
            />
            <button
              type="button"
              className="mini-button"
              onClick={() => setShowKey((current) => !current)}
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </div>

        <div className="settings-field">
          <label htmlFor="model">模型</label>
          <select
            id="model"
            className="input"
            value={model}
            disabled={models.length === 0}
            onChange={(event) => {
              setModel(event.target.value);
              setSaved(false);
              setMessage(`已选择 ${event.target.value}，点击「保存到本机」`);
            }}
          >
            {models.length === 0 ? (
              <option value={model}>
                {model || "先测试连接，加载模型列表"}
              </option>
            ) : null}
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <small className="settings-hint">
            模型列表来自 provider；选好后保存到本机。
          </small>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="button-primary"
            onClick={handleTest}
            disabled={!canTest}
          >
            {testState === "testing" ? "测试中…" : "测试连接"}
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={handleSave}
            disabled={!canSave}
          >
            保存到本机
          </button>
          <button
            type="button"
            className="mini-button danger"
            onClick={handleClear}
          >
            清除
          </button>
        </div>

        {message ? (
          <p
            className={`settings-status status-${testState} ${
              saved ? "is-saved" : ""
            }`}
          >
            {message}
          </p>
        ) : null}
      </section>

      <aside className="settings-card settings-note">
        <h2>Key 存在哪里？</h2>
        <ul>
          <li>只保存在本机浏览器 `localStorage`。</li>
          <li>不写入 SQLite，不保存到服务端。</li>
          <li>点「测试连接」时，key 会临时发给本地服务端转发给 provider，用完即弃。</li>
          <li>不要在多用户共享的浏览器上保存 key。</li>
          <li>清除浏览器数据或点「清除」即可移除。</li>
        </ul>
      </aside>
    </div>
  );
}
