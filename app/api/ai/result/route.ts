import { generateResultAnswer } from "@/lib/ai/engine/result-answer";
import type { InferenceProvider } from "@/lib/ai/engine/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const providers: InferenceProvider[] = [
  "mock",
  "openai",
  "anthropic",
  "deepseek",
];

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "请求格式不对" },
      { status: 400 },
    );
  }

  const nodeId = typeof body.nodeId === "string" ? body.nodeId : "";
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  const providerValue = typeof body.provider === "string" ? body.provider : "mock";
  const provider = providers.includes(providerValue as InferenceProvider)
    ? (providerValue as InferenceProvider)
    : null;
  const model = typeof body.model === "string" ? body.model : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const hint = typeof body.hint === "string" ? body.hint : "";

  if (!nodeId || !question) {
    return Response.json(
      { ok: false, error: "缺少结果便签或问题" },
      { status: 400 },
    );
  }

  if (!provider) {
    return Response.json(
      { ok: false, error: "未知的 AI provider" },
      { status: 400 },
    );
  }

  try {
    const result = await generateResultAnswer({
      nodeId,
      question,
      provider,
      model,
      apiKey,
      hint,
    });

    return Response.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成结果失败";
    return Response.json(
      { ok: false, error: message.slice(0, 500) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
