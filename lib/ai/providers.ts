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
};
