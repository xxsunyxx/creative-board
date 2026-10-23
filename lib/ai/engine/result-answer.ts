import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiUsage,
  canvasNodes,
  generationHistory,
  inferenceRuns,
} from "@/lib/db/schema";
import type { InferenceProvider, TokenUsage } from "./types";
import { emptyUsage } from "./types";
import { loadCanvasSnapshot } from "./snapshot";
import { buildInferenceContext } from "./context";
import {
  buildAnswerSystemPrompt,
  buildAnswerUserPrompt,
} from "./prompts";
import { callProviderText } from "./adapters";
import { getCanvasTokenTotal } from "./run";

function parseAnswer(text: string): string {
  const fenced = text.match(/```(?:json|markdown|md)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
        content?: unknown;
      };
      if (typeof parsed.content === "string") {
        const content = parsed.content
          .trim()
          .replace(/^(结论|结果)[:：]\s*/u, "");
        if (content.length > 20) {
          return content.slice(0, 4000);
        }
      }
    } catch {
      // Fall through to raw text.
    }
  }

  const raw = candidate.trim().replace(/^(结论|结果)[:：]\s*/u, "");
  if (raw.length < 20) {
    throw new Error("模型没有返回有效结果");
  }
  return raw.slice(0, 4000);
}

function mockAnswer({
  question,
  currentContent,
  incomingTitles,
}: {
  question: string;
  currentContent: string;
  incomingTitles: string[];
}) {
  const inputs = incomingTitles.length
    ? incomingTitles.join("、")
    : "上游材料";

  return `针对「${question}」，现有材料更支持的判断是：${inputs}不会直接决定结果，关键在于中间机制是否真的发生。${
    currentContent
      ? `原来的结论「${currentContent}」需要补上一个边界：它成立的前提是中间环节没有被削弱。`
      : "当前结果还缺少一个中间环节，不能直接下结论。"
  }如果这个环节缺失，结论可能反转；如果它成立，原来的判断才会稳定下来。`;
}

export async function generateResultAnswer({
  nodeId,
  question,
  provider,
  model,
  apiKey,
  hint = "",
}: {
  nodeId: string;
  question: string;
  provider: InferenceProvider;
  model: string;
  apiKey?: string;
  hint?: string;
}) {
  const selectedQuestion = question.trim();

  if (!selectedQuestion) {
    throw new Error("请先选择一个候选问题");
  }

  if (provider !== "mock" && (!apiKey?.trim() || !model.trim())) {
    throw new Error("请先在 AI 设置里配置 key 并选择模型");
  }

  const nodeRow = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .get();

  if (!nodeRow) {
    throw new Error("结果便签不存在");
  }

  const snapshot = loadCanvasSnapshot(nodeRow.canvasId);
  const node = snapshot.nodeById.get(nodeId);
  if (!node) {
    throw new Error("结果便签不存在");
  }

  const context = buildInferenceContext({
    snapshot,
    node,
    role: node.role,
    hint,
  });
  const runId = crypto.randomUUID();
  const modelName = model.trim() || "mock";
  const now = new Date();

  db.insert(inferenceRuns)
    .values({
      id: runId,
      canvasId: nodeRow.canvasId,
      taskType: "generate_result",
      status: "running",
      provider,
      model: modelName,
      hint,
      startedAt: now,
    })
    .run();

  try {
    let answer: string;
    let usage: TokenUsage = emptyUsage();

    if (provider === "mock") {
      answer = mockAnswer({
        question: selectedQuestion,
        currentContent: context.node.content,
        incomingTitles: context.incoming.map((item) => item.title),
      });
    } else {
      const raw = await callProviderText({
        provider,
        apiKey,
        model: modelName,
        system: buildAnswerSystemPrompt(),
        user: buildAnswerUserPrompt(context, selectedQuestion),
        maxTokens: 1800,
      });
      answer = parseAnswer(raw.text);
      usage = raw.usage;
    }

    const historyId = crypto.randomUUID();

    db.transaction((tx) => {
      tx.insert(generationHistory)
        .values({
          id: historyId,
          targetType: "canvas_node",
          targetId: nodeId,
          kind: "result_preview",
          candidates: [{ question: selectedQuestion, content: answer }],
          selected: selectedQuestion,
        })
        .run();

      tx.update(canvasNodes)
        .set({ selectedQuestion, updatedAt: new Date() })
        .where(eq(canvasNodes.id, nodeId))
        .run();

      tx.insert(aiUsage)
        .values({
          id: crypto.randomUUID(),
          runId,
          canvasId: nodeRow.canvasId,
          kind: "generate_result",
          provider,
          model: modelName,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        })
        .run();

      tx.update(inferenceRuns)
        .set({
          status: "succeeded",
          finishedAt: new Date(),
          error: null,
        })
        .where(eq(inferenceRuns.id, runId))
        .run();
    });

    return {
      runId,
      historyId,
      question: selectedQuestion,
      content: answer,
      usage,
      canvasTokens: getCanvasTokenTotal(nodeRow.canvasId),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成结果失败";
    db.update(inferenceRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: message.slice(0, 1000),
      })
      .where(eq(inferenceRuns.id, runId))
      .run();
    throw new Error(message);
  }
}
