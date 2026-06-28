import * as vscode from "vscode";
import { resolveDefaultModel, resolveDefaultProvider } from "./projectConfig";

export const providerIds = ["openai", "anthropic", "gemini", "zai", "mistral", "kimi", "groq", "openrouter", "together", "deepseek", "xai", "perplexity", "cerebras", "fireworks", "sambanova", "nvidia", "ollama", "lmstudio", "custom"] as const;
export type ProviderId = typeof providerIds[number];

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  baseUrl: string;
  secretKey: string;
}

const presets: Record<Exclude<ProviderId, "custom">, Omit<ProviderConfig, "id">> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    secretKey: "magnexis.apiKey.openai"
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    secretKey: "magnexis.apiKey.anthropic"
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    secretKey: "magnexis.apiKey.gemini"
  },
  zai: {
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    secretKey: "magnexis.apiKey.zai"
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    secretKey: "magnexis.apiKey.mistral"
  },
  kimi: {
    label: "Kimi/Moonshot",
    baseUrl: "https://api.moonshot.ai/v1",
    secretKey: "magnexis.apiKey.kimi"
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    secretKey: "magnexis.apiKey.groq"
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    secretKey: "magnexis.apiKey.openrouter"
  },
  together: {
    label: "Together AI",
    baseUrl: "https://api.together.ai/v1",
    secretKey: "magnexis.apiKey.together"
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    secretKey: "magnexis.apiKey.deepseek"
  },
  xai: {
    label: "xAI",
    baseUrl: "https://api.x.ai/v1",
    secretKey: "magnexis.apiKey.xai"
  },
  perplexity: {
    label: "Perplexity",
    baseUrl: "https://api.perplexity.ai/v1",
    secretKey: "magnexis.apiKey.perplexity"
  },
  cerebras: {
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    secretKey: "magnexis.apiKey.cerebras"
  },
  fireworks: {
    label: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    secretKey: "magnexis.apiKey.fireworks"
  },
  sambanova: {
    label: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    secretKey: "magnexis.apiKey.sambanova"
  },
  nvidia: {
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    secretKey: "magnexis.apiKey.nvidia"
  },
  ollama: {
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    secretKey: "magnexis.apiKey.ollama"
  },
  lmstudio: {
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    secretKey: "magnexis.apiKey.lmstudio"
  }
};

export function getProviderConfig(): ProviderConfig {
  const config = vscode.workspace.getConfiguration("magnexis");
  const id = config.get<ProviderId>("provider", resolveDefaultProvider("zai"));

  return getProviderConfigById(id);
}

export function getProviderConfigById(id: ProviderId): ProviderConfig {
  const config = vscode.workspace.getConfiguration("magnexis");

  if (id === "custom") {
    const baseUrl = config.get<string>("customBaseUrl", "").trim();
    return {
      id,
      label: "Custom",
      baseUrl,
      secretKey: "magnexis.apiKey.custom"
    };
  }

  return {
    id,
    ...presets[id]
  };
}

export function getModel(): string {
  return vscode.workspace.getConfiguration("magnexis").get<string>("model", resolveDefaultModel("glm-5.1")).trim();
}

export function getTemperature(): number {
  return vscode.workspace.getConfiguration("magnexis").get<number>("temperature", 0.2);
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && providerIds.includes(value as ProviderId);
}
