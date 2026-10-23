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
  buildQuestionSystemPrompt,
  buildQuestionUserPrompt,
} from "./prompts";
import { callProviderText } from "./adapters";
import { getCanvasTokenTotal } from "./run";

export type ResultQuestion = {
  question: string;
  angle?: string;
};

function parseQuestions(text: string): ResultQuestion[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
        questions?: unknown;
      };

      if (Array.isArray(parsed.questions)) {
        const questions = parsed.questions
          .map((item): ResultQuestion | null => {
            if (typeof item === "string") {
              const question = item.trim();
              return question ? { question } : null;
            }

            const row = item as { question?: unknown; angle?: unknown };
            const question =
              typeof row.question === "string" ? row.question.trim() : "";
            const angle =
              typeof row.angle === "string" ? row.angle.trim() : "";

            return question
              ? { question, angle: angle || undefined }
              : null;
          })
          .filter((item): item is ResultQuestion => Boolean(item))
          .slice(0, 5);

        if (questions.length > 0) {
          return questions;
        }
      }
    } catch {
      // Fall through to line parsing.
    }
  }

  const questions = candidate
    .split(/\r?\n/)
    .map((line) =>
      line.replace(/^[-*•\d.、\s]+/, "").trim(),
    )
    .filter((line) => line.length >= 8 && /[？?]/.test(line))
    .slice(0, 5)
    .map((question) => ({ question }));

  if (questions.length === 0) {
    throw new Error("模型没有返回有效问题");
  }

  return questions;
}

function mockQuestions({
  nodeTitle,
  incomingTitles,
}: {
  nodeTitle: string;
  incomingTitles: string[];
}): ResultQuestion[] {
  const first = incomingTitles[0] || "上游材料";
  const second = incomingTitles[1] || "另一个条件";

  return [
    {
      question: `「${first}」真正通过什么中间变量影响「${nodeTitle}」？`,
      angle: "机制",
    },
    {
      question: `在什么条件下，「${nodeTitle}」的结论会反转？`,
      angle: "边界",
    },
    {
      question: `「${second}」是在支持这个结论，还是在限制它？`,
      angle: "相互作用",
    },
    {
      question: `有没有一个反例，能说明这个结果并不普遍成立？`,
      angle: "反例",
    },
  ];
}

export async function generateResultQuestions({
  nodeId,
  provider,
  model,
  apiKey,
  hint = "",
}: {
  nodeId: string;
  provider: InferenceProvider;
  model: string;
  apiKey?: string;
  hint?: string;
}) {
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
      taskType: "generate_questions",
      status: "running",
      provider,
      model: modelName,
      hint,
      startedAt: now,
    })
    .run();

  try {
    let questions: ResultQuestion[];
    let usage: TokenUsage = emptyUsage();

    if (provider === "mock") {
      questions = mockQuestions({
        nodeTitle: node.title,
        incomingTitles: context.incoming.map((item) => item.title),
      });
    } else {
      const raw = await callProviderText({
        provider,
        apiKey,
        model: modelName,
        system: buildQuestionSystemPrompt(),
        user: buildQuestionUserPrompt(context),
        maxTokens: 1400,
      });
      questions = parseQuestions(raw.text);
      usage = raw.usage;
    }

    const historyId = crypto.randomUUID();

    db.transaction((tx) => {
      tx.insert(generationHistory)
        .values({
          id: historyId,
          targetType: "canvas_node",
          targetId: nodeId,
          kind: "result_questions",
          candidates: questions,
          selected: null,
        })
        .run();

      tx.insert(aiUsage)
        .values({
          id: crypto.randomUUID(),
          runId,
          canvasId: nodeRow.canvasId,
          kind: "generate_questions",
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
      questions,
      usage,
      canvasTokens: getCanvasTokenTotal(nodeRow.canvasId),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成候选问题失败";
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
