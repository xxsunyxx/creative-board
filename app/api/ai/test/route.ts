import type { AiProvider } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

const endpoints: Record<AiProvider, string> = {
  openai: "https://api.openai.com/v1/models",
  anthropic: "https://api.anthropic.com/v1/models",
  deepseek: "https://api.deepseek.com/models",
};

function sanitize(text: string, apiKey: string) {
  return text
    .slice(0, 400)
    .replaceAll(apiKey, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

function isChatModel(provider: AiProvider, id: string) {
  const value = id.toLowerCase();

  if (provider === "openai") {
    const looksLikeChat =
      value.startsWith("gpt-") ||
      value.startsWith("chatgpt-") ||
      /^o[1-9]/.test(value);
    const looksLikeTool = /(embedding|moderation|tts|whisper|dall-e|image|audio|realtime|transcribe|search)/.test(
      value,
    );
    return looksLikeChat && !looksLikeTool;
  }

  if (provider === "anthropic") {
    return value.startsWith("claude-");
  }

  return !/(embedding|rerank)/.test(value);
}

export async function POST(request: Request) {
  let body: { provider?: string; apiKey?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "请求格式不对" },
      { status: 400 },
    );
  }

  const provider = body.provider as AiProvider;
  const apiKey = body.apiKey?.trim() ?? "";

  if (
    !["openai", "anthropic", "deepseek"].includes(provider) ||
    apiKey.length < 10
  ) {
    return Response.json(
      { ok: false, error: "请选择 provider 并填写有效的 API key" },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(endpoints[provider], {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error: `HTTP ${response.status}: ${sanitize(text, apiKey)}`,
        },
        { status: 400 },
      );
    }

    let models: string[] = [];

    try {
      const data = JSON.parse(text) as { data?: unknown };
      if (Array.isArray(data.data)) {
        models = [
          ...new Set(
            data.data
              .map((item) => {
                const row = item as { id?: unknown };
                return typeof row.id === "string" ? row.id : "";
              })
              .filter(Boolean)
              .filter((id) => isChatModel(provider, id)),
          ),
        ].sort();
      }
    } catch {
      // The key is valid even if the response shape is unexpected.
    }

    return Response.json({
      ok: true,
      provider,
      models,
      modelCount: models.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "连接失败";
    return Response.json(
      {
        ok: false,
        error: sanitize(message, apiKey),
      },
      { status: 400 },
    );
  }
}
