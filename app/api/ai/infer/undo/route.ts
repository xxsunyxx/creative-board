import { undoInferenceRun } from "@/lib/ai/engine/run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const runId = typeof body.runId === "string" ? body.runId : "";

  if (!runId) {
    return Response.json(
      { ok: false, error: "缺少推理记录" },
      { status: 400 },
    );
  }

  try {
    const result = undoInferenceRun(runId);
    return Response.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "撤销失败";
    return Response.json(
      { ok: false, error: message.slice(0, 500) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
