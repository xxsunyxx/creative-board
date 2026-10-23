import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiUsage,
  canvasNodes,
  documents,
  inferenceRuns,
} from "@/lib/db/schema";
import type { InferenceProvider, TokenUsage } from "./types";
import { emptyUsage } from "./types";
import { loadCanvasSnapshot } from "./snapshot";
import { callProviderText, ProviderError } from "./adapters";
import {
  buildDocumentSystemPrompt,
  buildDocumentUserPrompt,
} from "./prompts";
import { getCanvasTokenTotal } from "./run";
import type {
  DocumentContext,
  DocumentMaterial,
  DocumentRelation,
} from "./document-types";

function truncate(value: string, max: number) {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function buildDocumentContext({
  nodeId,
  hint = "",
}: {
  nodeId: string;
  hint?: string;
}): DocumentContext {
  const node = db
    .select()
    .from(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .get();

  if (!node) {
    throw new Error("结果便签不存在");
  }

  const snapshot = loadCanvasSnapshot(node.canvasId);
  const resultNode = snapshot.nodeById.get(nodeId);

  if (!resultNode) {
    throw new Error("结果便签不存在");
  }

  const materials: DocumentMaterial[] = [];
  const relations: DocumentRelation[] = [];
  const seenNodes = new Set<string>([nodeId]);
  const seenEdges = new Set<string>();
  let frontier = [nodeId];

  for (let depth = 1; depth <= 3; depth += 1) {
    const next: string[] = [];

    for (const targetId of frontier) {
      const target = snapshot.nodeById.get(targetId);
      const incoming = snapshot.incoming.get(targetId) ?? [];

      for (const edge of incoming) {
        const source = snapshot.nodeById.get(edge.source);
        if (!source) {
          continue;
        }

        if (!seenEdges.has(edge.id)) {
          seenEdges.add(edge.id);
          const dimensions = snapshot.dimensionsByEdge.get(edge.id) ?? [];
          relations.push({
            id: edge.id,
            fromTitle: source.title,
            toTitle: target?.title ?? resultNode.title,
            relationTypes: [
              ...new Set(dimensions.map((item) => item.relationType)),
            ],
            selectedPaths: [
              ...new Set(dimensions.flatMap((item) => item.selectedPaths)),
            ],
          });
        }

        if (!seenNodes.has(source.id)) {
          seenNodes.add(source.id);
          materials.push({
            id: source.id,
            title: source.title,
            role: source.role,
            weight: source.weight,
            depth,
            content: truncate(source.content, 1000),
            note: truncate(source.note, 400),
          });
          next.push(source.id);
        }
      }
    }

    frontier = next;
    if (frontier.length === 0) {
      break;
    }
  }

  return {
    canvas: {
      name: snapshot.canvas.name,
      description: snapshot.canvas.description,
    },
    hint,
    result: {
      id: resultNode.id,
      title: resultNode.title,
      content: resultNode.content,
      selectedQuestion: node.selectedQuestion,
    },
    materials: materials
      .sort((a, b) => a.depth - b.depth || b.weight - a.weight)
      .slice(0, 10),
    relations,
  };
}

function parseDocumentOutput(
  text: string,
  fallbackTitle: string,
): { title: string; content: string } {
  const fenced = text.match(/```(?:json|markdown|md)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
        title?: unknown;
        content?: unknown;
      };
      const content =
        typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (content.length > 50) {
        const title =
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title.trim().slice(0, 80)
            : fallbackTitle;
        return {
          title,
          content: content.slice(0, 30_000),
        };
      }
    } catch {
      // Fall through to raw Markdown.
    }
  }

  const raw = candidate.trim();
  if (raw.length < 50) {
    throw new Error("模型没有返回有效文档");
  }

  return {
    title: fallbackTitle,
    content: raw.slice(0, 30_000),
  };
}

function buildMockDocument(context: DocumentContext) {
  const result = context.result.content.trim() || "（结果还是空白）";
  const evidence =
    context.materials.length > 0
      ? context.materials
          .map(
            (material) =>
              `- 「${material.title}」：${material.content || "（还没有内容）"}`,
          )
          .join("\n")
      : "- 目前没有上游材料，结论只能作为暂定假设。";
  const relationText =
    context.relations.length > 0
      ? context.relations
          .map(
            (relation) =>
              `- 「${relation.fromTitle}」→「${relation.toTitle}」：${
                relation.relationTypes.join(" / ") || "尚未选择关系"
              }`,
          )
          .join("\n")
      : "- 暂无关系链。";

  return {
    title: `${context.result.title || "结果"}：论证稿`,
    content: `# ${context.result.title || "结果"}

## 结论

${result}

## 论据

${evidence}

## 推理过程

先从上游材料里找出真正起作用的变量，再看它们如何通过中间环节影响结果。

${relationText}

现有结论可以理解为：在这些材料的相互作用下，结果不是一个孤立判断，而是有条件地成立。要让它更可靠，还需要补上中间机制和反例。

## 条件与边界

这个结论是否成立，取决于上游材料中的条件是否真的出现；如果关键条件缺失，结论可能反转。

## 尚未解决

目前还需要更具体的事实、反例或数据来验证这条论证链。`,
  };
}

export async function generateResultDocument({
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

  const context = buildDocumentContext({ nodeId, hint });
  const nodeRow = db
    .select({ canvasId: canvasNodes.canvasId })
    .from(canvasNodes)
    .where(eq(canvasNodes.id, nodeId))
    .get();

  if (!nodeRow) {
    throw new Error("结果便签不存在");
  }

  const canvasId = nodeRow.canvasId;
  const runId = crypto.randomUUID();
  const modelName = model.trim() || "mock";
  const now = new Date();

  db.insert(inferenceRuns)
    .values({
      id: runId,
      canvasId,
      taskType: "generate_document",
      status: "running",
      provider,
      model: modelName,
      hint,
      startedAt: now,
    })
    .run();

  try {
    let output: { title: string; content: string };
    let usage: TokenUsage = emptyUsage();

    if (provider === "mock") {
      output = buildMockDocument(context);
    } else {
      const raw = await callProviderText({
        provider,
        apiKey,
        model: modelName,
        system: buildDocumentSystemPrompt(),
        user: buildDocumentUserPrompt(context),
        maxTokens: 5000,
      });
      output = parseDocumentOutput(raw.text, context.result.title || "结果文档");
      usage = raw.usage;
    }

    const documentId = crypto.randomUUID();

    db.transaction((tx) => {
      tx.insert(documents)
        .values({
          id: documentId,
          outputNodeId: nodeId,
          title: output.title,
          content: output.content,
        })
        .run();

      tx.insert(aiUsage)
        .values({
          id: crypto.randomUUID(),
          runId,
          canvasId,
          kind: "generate_document",
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
      documentId,
      title: output.title,
      content: output.content,
      usage,
      canvasTokens: getCanvasTokenTotal(canvasId),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成文档失败";
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
