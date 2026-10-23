"use client";

import { useState } from "react";
import { setNodeSelectedQuestion } from "@/lib/actions/canvas";
import { readAiConfig } from "@/lib/ai/providers";

type ResultQuestion = {
  question: string;
  angle?: string;
};

export function ResultPanel({
  nodeId,
  title,
  content,
  role,
  initialQuestion,
  onSave,
  onExport,
  onQuestionSelected,
  onClose,
}: {
  nodeId: string;
  title: string;
  content: string;
  role: string;
  initialQuestion: string | null;
  onSave: (content: string) => Promise<void>;
  onExport: (content: string) => void;
  onQuestionSelected?: (question: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<ResultQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState(
    initialQuestion ?? "",
  );
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [questionTokens, setQuestionTokens] = useState<number | null>(null);

  const handleGenerateQuestions = () => {
    void (async () => {
      const config = readAiConfig();

      if (config && (!config.apiKey.trim() || !config.model.trim())) {
        setQuestionError("请先在 AI 设置里测试连接并选择模型");
        return;
      }

      setLoadingQuestions(true);
      setQuestionError("");
      setQuestionTokens(null);

      try {
        const response = await fetch("/api/ai/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId,
            provider: config?.provider ?? "mock",
            model: config?.model ?? "",
            apiKey: config?.apiKey ?? "",
          }),
        });
        const result = (await response.json()) as
          | {
              ok: true;
              questions: ResultQuestion[];
              usage: { totalTokens: number };
            }
          | { ok: false; error: string };

        if (!response.ok || !result.ok) {
          setQuestionError(
            result.ok ? "生成候选问题失败" : (result.error ?? "生成候选问题失败"),
          );
          return;
        }

        setQuestions(result.questions);
        setQuestionTokens(result.usage.totalTokens);
      } catch (error) {
        setQuestionError(
          error instanceof Error ? error.message : "生成候选问题失败",
        );
      } finally {
        setLoadingQuestions(false);
      }
    })();
  };

  const handleSelectQuestion = (question: string) => {
    setSelectedQuestion(question);
    void (async () => {
      try {
        await setNodeSelectedQuestion(nodeId, question);
        onQuestionSelected?.(question);
      } catch (error) {
        setQuestionError(
          error instanceof Error ? error.message : "保存问题失败",
        );
      }
    })();
  };

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
              角色：{role} · 先选一个问题，再把结果整理成稿。
            </p>
          </div>
          <button type="button" className="mini-button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="result-questions">
          <div className="result-questions-head">
            <div>
              <span className="result-label">候选问题</span>
              <small>
                根据入线和关系生成，选中后会记在这个结果节点上。
              </small>
            </div>
            <button
              type="button"
              className="mini-button"
              onClick={handleGenerateQuestions}
              disabled={loadingQuestions}
            >
              {loadingQuestions ? "生成中…" : "生成候选问题"}
            </button>
          </div>

          {questions.length > 0 ? (
            <div className="result-question-list">
              {questions.map((item) => {
                const active = item.question === selectedQuestion;
                return (
                  <button
                    key={item.question}
                    type="button"
                    className={`result-question ${active ? "is-selected" : ""}`}
                    onClick={() => handleSelectQuestion(item.question)}
                    aria-pressed={active}
                  >
                    <span>{item.question}</span>
                    {item.angle ? <small>{item.angle}</small> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="result-questions-empty">
              {loadingQuestions
                ? "正在读入线和关系…"
                : "还没有候选问题。先保存正文，再生成问题会更准。"}
            </p>
          )}

          {selectedQuestion ? (
            <p className="result-selected-question">
              已选：{selectedQuestion}
            </p>
          ) : null}
          {questionTokens !== null ? (
            <p className="result-question-meta">
              候选问题 · {questionTokens} tokens
            </p>
          ) : null}
          {questionError ? (
            <p className="result-question-error">{questionError}</p>
          ) : null}
        </div>

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
          <span>下一步：选中问题后生成结果，再保存为文档。</span>
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
            disabled={!draft.trim()}
          >
            生成完整文档
          </button>
          <button type="button" className="mini-button" onClick={onClose}>
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
