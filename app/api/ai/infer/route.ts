import { runInference } from "@/lib/ai/engine/run";
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

  const canvasId = typeof body.canvasId === "string" ? body.canvasId : "";
  const providerValue = typeof body.provider === "string" ? body.provider : "mock";
  const provider = providers.includes(providerValue as InferenceProvider)
    ? (providerValue as InferenceProvider)
    : null;
  const model = typeof body.model === "string" ? body.model : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const hint = typeof body.hint === "string" ? body.hint : "";

  if (!canvasId) {
    return Response.json(
      { ok: false, error: "缺少画布" },
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
    const result = await runInference({
      canvasId,
      hint,
      provider,
      model,
      apiKey,
    });

    return Response.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "推理失败";
    return Response.json(
      { ok: false, error: message.slice(0, 500) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
