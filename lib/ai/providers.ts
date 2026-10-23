export type AiProvider = "openai" | "anthropic" | "deepseek";

export type AiProviderOption = {
  id: AiProvider;
  label: string;
  keyHint: string;
  description: string;
};

export const AI_PROVIDERS: AiProviderOption[] = [
  {
    id: "openai",
    label: "OpenAI",
    keyHint: "sk-...",
    description: "GPT 系列",
  },
  {
    id: "anthropic",
    label: "Claude",
    keyHint: "sk-ant-...",
    description: "Anthropic Claude",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    keyHint: "sk-...",
    description: "DeepSeek / OpenAI 兼容",
  },
];

export const AI_CONFIG_STORAGE_KEY = "cb-ai-config";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

export function readAiConfig(): AiConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const stored = JSON.parse(raw) as Partial<AiConfig>;
    if (
      !stored.provider ||
      !AI_PROVIDERS.some((item) => item.id === stored.provider)
    ) {
      return null;
    }

    return {
      provider: stored.provider,
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey : "",
      model: typeof stored.model === "string" ? stored.model : "",
    };
  } catch {
    return null;
  }
}
