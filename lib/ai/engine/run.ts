import { and, count, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiUsage,
  canvasNodes,
  inferencePatches,
  inferenceRuns,
} from "@/lib/db/schema";
import type { NoteRole } from "@/lib/canvas-types";
import { callProvider, ProviderError, type ProviderOutput } from "./adapters";
import { buildInferenceContext } from "./context";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import {
  getBlankNodes,
  inferRoleFromTopology,
  planInferenceWaves,
} from "./planner";
import { loadCanvasSnapshot } from "./snapshot";
import {
  emptyUsage,
  type InferencePatchDto,
  type InferenceProvider,
  type NodePatchFields,
  type RunInferenceInput,
  type RunInferenceResult,
  type TokenUsage,
} from "./types";

const allowedProviders: InferenceProvider[] = [
  "mock",
  "openai",
  "anthropic",
  "deepseek",
];

function sanitizeMessage(error: unknown, apiKey?: string) {
  const raw = error instanceof Error ? error.message : "推理失败";
  const safe = apiKey ? raw.replaceAll(apiKey, "[redacted]") : raw;
  return safe.slice(0, 500);
}

function isRetryable(error: unknown) {
  if (error instanceof ProviderError) {
    if (error.status === 429 || (error.status ?? 0) >= 500) {
      return true;
    }
    const message = error.message.toLowerCase();
    return message.includes("json") || message.includes("内容");
  }

  return (
    error instanceof Error &&
    (error.message.includes("JSON") || error.message.includes("内容"))
  );
}

function isFatalProviderError(error: unknown) {
  return (
    error instanceof ProviderError &&
    [401, 403, 404].includes(error.status ?? 0)
  );
}

function addUsage(first: TokenUsage, second: TokenUsage): TokenUsage {
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    totalTokens: first.totalTokens + second.totalTokens,
  };
}

function contentIssue(
  content: string,
  context: ReturnType<typeof buildInferenceContext>,
) {
  if (/(维度|入线|出线|关系类型|已选维度)/.test(content)) {
    return "正文出现了「维度 / 入线 / 出线 / 关系类型」这类系统词";
  }

  const focusPhrases = [
    ...context.incoming,
    ...context.outgoing,
  ].flatMap((neighbor) => neighbor.edge.selectedPaths);

  if (
    focusPhrases.some(
      (phrase) => phrase.length >= 3 && content.includes(phrase),
    )
  ) {
    return "正文原样复述了提示词里的维度短语";
  }

  if (context.node.role === "result") {
    if (/(任何一种|必然|一定会|所有都|完全不会|从不)/.test(content)) {
      return "结果用了绝对化表达，缺少条件或边界";
    }

    if (
      !/(因为|所以|因此|但|如果|当|取决于|意味着|导致|通过|才|否则|反而)/.test(
        content,
      )
    ) {
      return "结果缺少中间机制或条件，像直接喊结论";
    }
  }

  return null;
}

export function getCanvasTokenTotal(canvasId: string) {
  const row = db
    .select({
      total: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
    })
    .from(aiUsage)
    .where(eq(aiUsage.canvasId, canvasId))
    .get();

  return Number(row?.total ?? 0);
}

export function getLatestUndoableRunId(canvasId: string) {
  const run = db
    .select()
    .from(inferenceRuns)
    .where(
      and(
        eq(inferenceRuns.canvasId, canvasId),
        inArray(inferenceRuns.status, ["succeeded", "partial"]),
      ),
    )
    .orderBy(desc(inferenceRuns.startedAt))
    .get();

  if (!run) {
    return null;
  }

  const remaining = db
    .select({ total: count() })
    .from(inferencePatches)
    .where(
      and(
        eq(inferencePatches.runId, run.id),
        isNull(inferencePatches.undoneAt),
      ),
    )
    .get();

  return Number(remaining?.total ?? 0) > 0 ? run.id : null;
}

export async function runInference(
  input: RunInferenceInput,
): Promise<RunInferenceResult> {
  if (!input.canvasId) {
    throw new Error("缺少画布");
  }

  if (!allowedProviders.includes(input.provider)) {
    throw new Error("未知的 AI provider");
  }

  if (
    input.provider !== "mock" &&
    (!input.apiKey?.trim() || !input.model.trim())
  ) {
    throw new Error("请先在 AI 设置里配置 key 并选择模型");
  }

  const snapshot = loadCanvasSnapshot(input.canvasId);
  const blankNodes = getBlankNodes(snapshot);
  const hint = (input.hint ?? "").trim().slice(0, 300);
  const runId = crypto.randomUUID();
  const model = input.model.trim() || "mock";
  const usage: TokenUsage = emptyUsage();
  const patches: InferencePatchDto[] = [];
  const errors: string[] = [];

  const running = db
    .select()
    .from(inferenceRuns)
    .where(
      and(
        eq(inferenceRuns.canvasId, input.canvasId),
        eq(inferenceRuns.status, "running"),
      ),
    )
    .get();

  if (running) {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);

    if (running.startedAt < staleBefore) {
      db.update(inferenceRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          error: "推理超时，已自动结束",
        })
        .where(eq(inferenceRuns.id, running.id))
        .run();
    } else {
      throw new Error("这个画布正在推理，请稍候");
    }
  }

  const roleById = new Map<string, NoteRole>();
  for (const node of blankNodes) {
    roleById.set(
      node.id,
      inferRoleFromTopology(
        node,
        snapshot.incoming.get(node.id)?.length ?? 0,
        snapshot.outgoing.get(node.id)?.length ?? 0,
      ),
    );
  }

  const waves = planInferenceWaves(snapshot, blankNodes);

  db.insert(inferenceRuns)
    .values({
      id: runId,
      canvasId: input.canvasId,
      taskType: "fill_blank_notes",
      status: "running",
      provider: input.provider,
      model,
      hint,
    })
    .run();

  try {
    let fatal = false;

    for (const wave of waves) {
      for (const node of wave) {
        try {
          const role = roleById.get(node.id) ?? node.role;
          const context = buildInferenceContext({
            snapshot,
            node,
            role,
            hint,
          });
          let output: ProviderOutput;

          try {
            output = await callProvider({
              provider: input.provider,
              apiKey: input.apiKey,
              model: input.model,
              system: buildSystemPrompt(role),
              user: buildUserPrompt(context),
              context,
            });
          } catch (firstError) {
            if (!isRetryable(firstError)) {
              throw firstError;
            }

            output = await callProvider({
              provider: input.provider,
              apiKey: input.apiKey,
              model: input.model,
              system: buildSystemPrompt(role),
              user: `${buildUserPrompt(context)}\n\n注意：只输出一个合法的 JSON 对象。`,
              context,
            });
          }

          const issue = contentIssue(output.content, context);

          if (input.provider !== "mock" && issue) {
            const firstOutput = output;
            const focusList = [
              ...context.incoming,
              ...context.outgoing,
            ]
              .flatMap((neighbor) => neighbor.edge.selectedPaths)
              .filter(Boolean)
              .join("」「");

            try {
              const rewritten = await callProvider({
                provider: input.provider,
                apiKey: input.apiKey,
                model: input.model,
                system: buildSystemPrompt(role),
                user: `${buildUserPrompt(context)}\n\n上一版的问题：${issue}。请保留判断，但重写成自然语言：不要出现「维度」「入线」「出线」「关系类型」。${
                  focusList
                    ? `也不要原样复述「${focusList}」这类角度短语。`
                    : ""
                }${
                  role === "result"
                    ? "结果必须至少包含一个中间机制或条件，读起来像一段有前因后果的论证，而不是口号。"
                    : ""
                }`,
                context,
              });
              output = {
                ...rewritten,
                usage: addUsage(firstOutput.usage, rewritten.usage),
              };
            } catch {
              output = firstOutput;
            }
          }

          const content = output.content.trim().slice(0, 1200);
          if (!content) {
            throw new Error("模型没有返回内容");
          }

          const before: NodePatchFields = {
            role: node.role,
            title: node.title,
            content: node.content,
            roleLocked: node.roleLocked,
          };
          const after: NodePatchFields = {
            role,
            title: output.title?.trim() || node.title,
            content,
            roleLocked: node.roleLocked,
          };
          const patchId = crypto.randomUUID();
          const usageId = crypto.randomUUID();

          db.transaction((tx) => {
            tx.update(canvasNodes)
              .set({
                type: after.role,
                title: after.title,
                content: after.content,
                roleLocked: after.roleLocked,
                updatedAt: new Date(),
              })
              .where(eq(canvasNodes.id, node.id))
              .run();

            tx.insert(inferencePatches)
              .values({
                id: patchId,
                runId,
                nodeId: node.id,
                beforeJson: before,
                afterJson: after,
              })
              .run();

            tx.insert(aiUsage)
              .values({
                id: usageId,
                runId,
                canvasId: input.canvasId,
                kind: "fill_blank_notes",
                provider: input.provider,
                model,
                inputTokens: output.usage.inputTokens,
                outputTokens: output.usage.outputTokens,
                totalTokens: output.usage.totalTokens,
              })
              .run();
          });

          const live = snapshot.nodeById.get(node.id);
          if (live) {
            live.role = after.role;
            live.title = after.title;
            live.content = after.content;
            live.roleLocked = after.roleLocked;
          }

          patches.push({ nodeId: node.id, before, after });
          usage.inputTokens += output.usage.inputTokens;
          usage.outputTokens += output.usage.outputTokens;
          usage.totalTokens += output.usage.totalTokens;
        } catch (error) {
          errors.push(sanitizeMessage(error, input.apiKey));

          if (isFatalProviderError(error)) {
            fatal = true;
            break;
          }
        }
      }

      if (fatal) {
        break;
      }
    }

    const status: RunInferenceResult["status"] =
      errors.length === 0
        ? "succeeded"
        : patches.length > 0
          ? "partial"
          : "failed";

    db.update(inferenceRuns)
      .set({
        status,
        finishedAt: new Date(),
        error: errors.length > 0 ? errors.join("; ").slice(0, 1000) : null,
      })
      .where(eq(inferenceRuns.id, runId))
      .run();

    return {
      runId,
      status,
      patches,
      usage,
      canvasTokens: getCanvasTokenTotal(input.canvasId),
      errors,
    };
  } catch (error) {
    const message = sanitizeMessage(error, input.apiKey);

    db.update(inferenceRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: message,
      })
      .where(eq(inferenceRuns.id, runId))
      .run();

    throw new Error(message);
  }
}

export function undoInferenceRun(runId: string) {
  const run = db
    .select()
    .from(inferenceRuns)
    .where(eq(inferenceRuns.id, runId))
    .get();

  if (!run) {
    throw new Error("推理记录不存在");
  }

  const patches = db
    .select()
    .from(inferencePatches)
    .where(
      and(
        eq(inferencePatches.runId, runId),
        isNull(inferencePatches.undoneAt),
      ),
    )
    .all();

  const result: InferencePatchDto[] = [];

  db.transaction((tx) => {
    for (const patch of patches) {
      const before = patch.beforeJson as unknown as NodePatchFields;
      const after = patch.afterJson as unknown as NodePatchFields;

      tx.update(canvasNodes)
        .set({
          type: before.role,
          title: before.title,
          content: before.content,
          roleLocked: before.roleLocked,
          updatedAt: new Date(),
        })
        .where(eq(canvasNodes.id, patch.nodeId))
        .run();

      tx.update(inferencePatches)
        .set({ undoneAt: new Date() })
        .where(eq(inferencePatches.id, patch.id))
        .run();

      result.push({ nodeId: patch.nodeId, before, after });
    }
  });

  return {
    runId,
    patches: result,
    canvasTokens: getCanvasTokenTotal(run.canvasId),
  };
}
