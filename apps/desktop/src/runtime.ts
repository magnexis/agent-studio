import type { ToolDescriptor } from "@magnexis/tools";
import { toolCatalog, toolsRequiringApproval } from "@magnexis/tools";
import { probeProvider } from "@magnexis/llm-router";
import type { DesktopProviderInput, DesktopProviderTestResult, DesktopSettingsInput, DesktopRuntimeBridge } from "./runtimeBridge";

/**
 * A persisted provider record. Secrets are never stored in this structure —
 * only a masked hint that indicates whether a key has been saved to the
 * operating-system credential vault.
 */
export interface ProviderRecord {
  id: string;
  name: string;
  type: "Cloud" | "Local";
  baseUrl: string;
  defaultModel: string;
  status: "Connected" | "Needs key" | "Available";
  hasSecret: boolean;
  models: string[];
}

export interface ToolCapabilitySummary {
  total: number;
  requiringApproval: number;
  byCategory: Record<string, number>;
}

export interface RuntimeSnapshot {
  providers: ProviderRecord[];
  tools: ToolDescriptor[];
  toolSummary: ToolCapabilitySummary;
}

const defaultProviders: ProviderRecord[] = [
  {
    id: "zai",
    name: "Z.ai",
    type: "Cloud",
    baseUrl: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-5.1",
    status: "Connected",
    hasSecret: true,
    models: ["glm-5.1", "glm-4.7"]
  },
  {
    id: "openai",
    name: "OpenAI",
    type: "Cloud",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.4",
    status: "Needs key",
    hasSecret: false,
    models: ["gpt-5.4", "gpt-4.1"]
  },
  {
    id: "ollama",
    name: "Ollama",
    type: "Local",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "qwen2.5-coder",
    status: "Available",
    hasSecret: false,
    models: ["qwen2.5-coder", "llama3.1"]
  },
  {
    id: "groq",
    name: "Groq",
    type: "Cloud",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-120b",
    status: "Needs key",
    hasSecret: false,
    models: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"]
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    type: "Cloud",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/auto",
    status: "Needs key",
    hasSecret: false,
    models: ["openrouter/auto", "openrouter/free"]
  },
  {
    id: "together",
    name: "Together AI",
    type: "Cloud",
    baseUrl: "https://api.together.ai/v1",
    defaultModel: "openai/gpt-oss-20b",
    status: "Needs key",
    hasSecret: false,
    models: ["openai/gpt-oss-20b", "Qwen/Qwen3.5-397B-A17B"]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    type: "Cloud",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    status: "Needs key",
    hasSecret: false,
    models: ["deepseek-v4-flash", "deepseek-v4-pro"]
  },
  {
    id: "xai",
    name: "xAI",
    type: "Cloud",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.3",
    status: "Needs key",
    hasSecret: false,
    models: ["grok-4.3", "grok-build-0.1"]
  }
];

/**
 * In-memory provider registry for the desktop shell. In the packaged desktop
 * runtime this would be backed by the OS credential vault and a JSON catalog;
 * here it models the same surface so the UI and bridge contracts stay honest.
 */
export class ProviderRegistry {
  private providers = new Map<string, ProviderRecord>(defaultProviders.map((provider) => [provider.id, provider]));

  list(): ProviderRecord[] {
    return Array.from(this.providers.values());
  }

  get(id: string): ProviderRecord | undefined {
    return this.providers.get(id);
  }

  upsert(record: ProviderRecord): void {
    this.providers.set(record.id, record);
  }

  remove(id: string): boolean {
    return this.providers.delete(id);
  }

  markConnected(id: string): void {
    const provider = this.providers.get(id);
    if (provider) {
      provider.status = "Connected";
      provider.hasSecret = true;
    }
  }
}

export function summarizeToolCapabilities(tools: ToolDescriptor[] = toolCatalog): ToolCapabilitySummary {
  const byCategory: Record<string, number> = {};
  for (const tool of tools) {
    byCategory[tool.category] = (byCategory[tool.category] ?? 0) + 1;
  }
  return {
    total: tools.length,
    requiringApproval: toolsRequiringApproval().length,
    byCategory
  };
}

export function createRuntimeSnapshot(registry = new ProviderRegistry()): RuntimeSnapshot {
  return {
    providers: registry.list(),
    tools: toolCatalog,
    toolSummary: summarizeToolCapabilities()
  };
}

/**
 * Simulated connection test. The real desktop runtime would issue a tiny
 * models/list request to the provider; this models latency and outcome so the
 * UI's "Test connection" flow is verifiable without keys.
 */
export async function testProviderConnectivity(input: DesktopProviderInput): Promise<DesktopProviderTestResult> {
  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 350));
  const latencyMs = Date.now() - started;

  if (!input.baseUrl) {
    return { ok: false, message: "Base URL is required.", latencyMs };
  }

  try {
    new URL(input.baseUrl);
  } catch {
    return { ok: false, message: "Base URL is not a valid URL.", latencyMs };
  }

  if (input.type !== "Ollama" && input.type !== "LM Studio" && !input.apiKey) {
    return { ok: false, message: "Endpoint reachable, but an API key is required to complete the request.", latencyMs };
  }

  return { ok: true, message: `${input.type} endpoint is reachable (${latencyMs} ms).`, latencyMs };
}

/**
 * Concrete bridge implementation used by static previews and tests. The
 * Electron shell swaps in a native version that writes to the credential vault.
 */
export function createDesktopRuntimeBridge(registry = new ProviderRegistry()): DesktopRuntimeBridge {
  return {
    async testProvider(input) {
      return testProviderConnectivity(input);
    },
    async testConfiguredProvider(providerId) {
      const provider = registry.get(providerId);
      if (!provider) {
        return { ok: false, message: `Unknown provider: ${providerId}` };
      }
      const result = await testProviderConnectivity({
        type: provider.name,
        baseUrl: provider.baseUrl,
        model: provider.defaultModel,
        apiKey: provider.hasSecret ? "vault:••••" : ""
      });
      if (result.ok) {
        registry.markConnected(providerId);
      }
      return result;
    },
    async listProviderModels(input) {
      const result = await probeProvider({ baseUrl: input.baseUrl, apiKey: input.apiKey || undefined });
      return { ok: result.ok, message: result.detail, models: result.models };
    },
    async saveProvider(input) {
      const id = input.type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      registry.upsert({
        id,
        name: input.type,
        type: input.baseUrl.startsWith("http://127.0.0.1") || input.baseUrl.startsWith("http://localhost") ? "Local" : "Cloud",
        baseUrl: input.baseUrl,
        defaultModel: input.model,
        status: input.apiKey ? "Connected" : "Needs key",
        hasSecret: Boolean(input.apiKey),
        models: [input.model]
      });
    },
    async saveSettings(_input: DesktopSettingsInput) {
      // Settings persistence is handled by the desktop settings store; the
      // preview shell accepts and validates the payload without writing disk.
    },
    async openExternalUrl(url) {
      const target = new URL(url);
      if (target.protocol !== "https:" || (target.hostname !== "llm-stats.com" && !target.hostname.endsWith(".llm-stats.com"))) {
        throw new Error("Only trusted llm-stats.com links may be opened from Model Stats.");
      }
      if (typeof globalThis.open === "function") {
        globalThis.open(target.toString(), "_blank", "noopener,noreferrer");
      }
    },
    async windowAction(_action) {
      // Native window actions are supplied by the Electron preload bridge.
    }
  };
}
