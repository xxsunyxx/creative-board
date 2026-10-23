import { inferNoteContent } from "@/lib/ai/mock";
import type { NoteRole } from "@/lib/canvas-types";
import type {
  InferenceContext,
  InferenceProvider,
  TokenUsage,
} from "./types";
import { emptyUsage } from "./types";

export class ProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export type ProviderOutput = {
  content: string;
  title?: string;
  role?: NoteRole;
  usage: TokenUsage;
};

type AdapterInput = {
  provider: InferenceProvider;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  context: InferenceContext;
};

const allowedRoles: NoteRole[] = ["inspiration", "process", "result"];

function sanitize(text: string, apiKey: string) {
  const safe = apiKey ? text.replaceAll(apiKey, "[redacted]") : text;
  return safe.slice(0, 500).replace(/\s+/g, " ").trim();
}

function humanizeContent(value: string) {
  return value
    .replace(/^(结论|结果|过程|灵感)[:：]\s*/u, "")
    .trim();
}

function parseModelJson(text: string): ProviderOutput {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new ProviderError("模型没有返回 JSON");
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    throw new ProviderError("模型返回的 JSON 无法解析");
  }

  const rawContent =
    typeof parsed.content === "string" ? parsed.content.trim() : "";
  const content = humanizeContent(rawContent);

  if (content.length < 5) {
    throw new ProviderError("模型没有返回有效内容");
  }

  const role = allowedRoles.includes(parsed.role as NoteRole)
    ? (parsed.role as NoteRole)
    : undefined;
  const title =
    typeof parsed.title === "string"
      ? parsed.title.trim().slice(0, 40) || undefined
      : undefined;

  return {
    content: content.slice(0, 1200),
    title,
    role,
    usage: emptyUsage(),
  };
}

function normalizeChatUsage(raw: unknown): TokenUsage {
  const usage = (raw ?? {}) as Record<string, unknown>;
  const inputTokens = Number(usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? 0);
  const totalTokens = Number(
    usage.total_tokens ?? inputTokens + outputTokens,
  );

  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}

function normalizeAnthropicUsage(raw: unknown): TokenUsage {
  const usage = (raw ?? {}) as Record<string, unknown>;
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);

  return {
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    totalTokens:
      (Number.isFinite(inputTokens) ? inputTokens : 0) +
      (Number.isFinite(outputTokens) ? outputTokens : 0),
  };
}

async function postJson(
  url: string,
  init: RequestInit,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(60_000),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new ProviderError(
      `HTTP ${response.status}: ${sanitize(text, apiKey)}`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ProviderError("provider 返回了非 JSON 响应");
  }
}

async function callOpenAiCompatible({
  url,
  apiKey,
  model,
  system,
  user,
}: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<ProviderOutput> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const request = (body: Record<string, unknown>) =>
    postJson(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      apiKey,
    );

  let data: Record<string, unknown>;

  try {
    data = await request({
      model,
      temperature: 0.5,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages,
    });
  } catch (error) {
    if (error instanceof ProviderError && error.status === 400) {
      const message = error.message.toLowerCase();
      const unsupported = /(temperature|max_tokens|response_format|unsupported|not supported|unrecognized|unknown parameter)/.test(
        message,
      );

      if (unsupported) {
        data = await request({ model, messages });
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0] as
    | { message?: { content?: unknown } }
    | undefined;
  const text = first?.message?.content;

  if (typeof text !== "string" || !text.trim()) {
    throw new ProviderError("provider 没有返回内容");
  }

  return {
    ...parseModelJson(text),
    usage: normalizeChatUsage(data.usage),
  };
}

async function callAnthropic({
  apiKey,
  model,
  system,
  user,
}: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<ProviderOutput> {
  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.5,
        system,
        messages: [{ role: "user", content: user }],
      }),
    },
    apiKey,
  );

  const blocks = Array.isArray(data.content) ? data.content : [];
  const text = blocks
    .map((block) => {
      const item = block as { type?: string; text?: string };
      return item.type === "text" ? (item.text ?? "") : "";
    })
    .filter(Boolean)
    .join("\n");

  if (!text.trim()) {
    throw new ProviderError("provider 没有返回内容");
  }

  return {
    ...parseModelJson(text),
    usage: normalizeAnthropicUsage(data.usage),
  };
}

export async function callProvider(
  input: AdapterInput,
): Promise<ProviderOutput> {
  if (input.provider === "mock") {
    const relationTypes = [
      ...input.context.incoming,
      ...input.context.outgoing,
    ].flatMap((neighbor) => neighbor.edge.relationTypes);
    const content = humanizeContent(
      inferNoteContent({
        role: input.context.node.role,
        incomingTitles: input.context.incoming.map((item) => item.title),
        outgoingTitles: input.context.outgoing.map((item) => item.title),
        relationTypes,
      }),
    );

    return {
      content: input.context.hint
        ? `${content}\n提示：${input.context.hint}`
        : content,
      role: input.context.node.role,
      usage: emptyUsage(),
    };
  }

  if (!input.apiKey) {
    throw new ProviderError("缺少 API key");
  }

  if (!input.model) {
    throw new ProviderError("缺少模型");
  }

  if (input.provider === "openai") {
    return callOpenAiCompatible({
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: input.apiKey,
      model: input.model,
      system: input.system,
      user: input.user,
    });
  }

  if (input.provider === "deepseek") {
    return callOpenAiCompatible({
      url: "https://api.deepseek.com/chat/completions",
      apiKey: input.apiKey,
      model: input.model,
      system: input.system,
      user: input.user,
    });
  }

  return callAnthropic({
    apiKey: input.apiKey,
    model: input.model,
    system: input.system,
    user: input.user,
  });
}
