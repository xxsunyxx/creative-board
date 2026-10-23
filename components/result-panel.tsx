"use client";

import { useState } from "react";

export function ResultPanel({
  title,
  content,
  role,
  onSave,
  onExport,
  onClose,
}: {
  title: string;
  content: string;
  role: string;
  onSave: (content: string) => Promise<void>;
  onExport: (content: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);

  return (
    <div className="result-backdrop" onClick={onClose}>
      <section
        className="result-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="result-panel-head">
          <div>
            <p className="page-kicker">Result Output</p>
            <h2>{title || "未命名结果"}</h2>
            <p>
              角色：{role} · 先在这里整理成稿，再保存到文档区。
            </p>
          </div>
          <button type="button" className="mini-button" onClick={onClose}>
            关闭
          </button>
        </header>

        <label className="result-label" htmlFor="result-content">
          结果正文
        </label>
        <textarea
          id="result-content"
          className="result-textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="结果节点还没有正文。先写一段，或等候选问题 / 结果生成接入。"
          rows={10}
        />

        <div className="result-panel-meta">
          <span>下一步会在这里接候选问题 → 结果预览 → 多篇文档。</span>
        </div>

        <div className="result-panel-actions">
          <button
            type="button"
            className="button-primary button-small"
            disabled={saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                try {
                  await onSave(draft);
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            {saving ? "保存中…" : "保存正文"}
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={() => onExport(draft)}
          >
            导出为文档
          </button>
          <button type="button" className="mini-button" onClick={onClose}>
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
