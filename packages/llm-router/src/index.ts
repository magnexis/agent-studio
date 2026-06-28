import type { LLMModelConfig, LLMProviderConfig, LLMProviderType, ModelRuntimeLimits } from "../../types/src/index";

export interface ProviderPreset {
  id: LLMProviderType;
  name: string;
  baseUrl?: string;
  isLocal: boolean;
  description?: string;
  iconId?: string;
  models?: LLMModelConfig[];
}

export const providerPresets: ProviderPreset[] = [
  preset("openai", "OpenAI", "https://api.openai.com/v1", "Frontier reasoning and coding", false, [
    model("gpt-5.4", "GPT-5.4", "openai", 1050000, 128000, "https://developers.openai.com/api/docs/models/gpt-5.4", ["coding", "planning", "large-context"]),
    model("gpt-4.1", "GPT-4.1", "openai", 1047576, 32768, "https://developers.openai.com/api/docs/models/gpt-4.1", ["coding", "large-context"]),
    dynamicModel("o3", "o3", "openai", "https://developers.openai.com/api/docs/models"),
    dynamicModel("gpt-4o", "GPT-4o", "openai", "https://developers.openai.com/api/docs/models"),
    dynamicModel("gpt-4.1-mini", "GPT-4.1 mini", "openai", "https://developers.openai.com/api/docs/models")
  ]),
  preset("anthropic", "Anthropic", "https://api.anthropic.com/v1", "Claude agentic coding models", false, [
    model("claude-opus-4-7", "Claude Opus 4.7", "anthropic", 1000000, 128000, "https://platform.claude.com/docs/en/about-claude/models/overview", ["coding", "planning", "large-context"]),
    model("claude-sonnet-4-6", "Claude Sonnet 4.6", "anthropic", 1000000, 64000, "https://platform.claude.com/docs/en/about-claude/models/overview", ["coding", "fast-edits", "large-context"]),
    model("claude-haiku-4-5", "Claude Haiku 4.5", "anthropic", 200000, 64000, "https://platform.claude.com/docs/en/about-claude/models/overview", ["chat", "fast-edits"]),
    dynamicModel("claude-sonnet-4", "Claude Sonnet 4", "anthropic", "https://platform.claude.com/docs/en/about-claude/models/overview"),
    dynamicModel("claude-opus-4", "Claude Opus 4", "anthropic", "https://platform.claude.com/docs/en/about-claude/models/overview")
  ]),
  preset("gemini", "Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "Long-context multimodal models", false, [
    model("gemini-3.5-flash", "Gemini 3.5 Flash", "gemini", 1048576, 65536, "https://ai.google.dev/gemini-api/docs/models", ["coding", "fast-edits", "large-context"], "preview"),
    model("gemini-2.5-pro", "Gemini 2.5 Pro", "gemini", 1048576, 65536, "https://ai.google.dev/gemini-api/docs/models", ["coding", "planning", "large-context"]),
    dynamicModel("gemini-2.5-flash", "Gemini 2.5 Flash", "gemini", "https://ai.google.dev/gemini-api/docs/models"),
    dynamicModel("gemini-2.0-flash", "Gemini 2.0 Flash", "gemini", "https://ai.google.dev/gemini-api/docs/models")
  ]),
  preset("zai", "Z.ai", "https://api.z.ai/api/paas/v4", "GLM models for agentic engineering", false, [
    model("glm-5.1", "GLM-5.1", "zai", 204800, 131072, "https://docs.z.ai/guides/llm/glm-5.1", ["coding", "planning"]),
    model("glm-4.7", "GLM-4.7", "zai", 204800, 131072, "https://docs.z.ai/guides/llm/glm-4.7", ["coding", "fast-edits"]),
    dynamicModel("glm-4.5-air", "GLM-4.5 Air", "zai", "https://docs.z.ai/guides/llm"),
    dynamicModel("glm-4.5v", "GLM-4.5V", "zai", "https://docs.z.ai/guides/llm")
  ]),
  preset("mistral", "Mistral", "https://api.mistral.ai/v1", "European coding and reasoning models", false, [
    model("devstral-2", "Devstral 2", "mistral", 262144, 65536, "https://docs.mistral.ai/resources/known-limitations", ["coding", "large-context"]),
    model("codestral-latest", "Codestral", "mistral", 131072, 32768, "https://docs.mistral.ai/resources/known-limitations", ["coding", "fast-edits"]),
    dynamicModel("mistral-medium-latest", "Mistral Medium", "mistral", "https://docs.mistral.ai/getting-started/models/models_overview/"),
    dynamicModel("ministral-8b-latest", "Ministral 8B", "mistral", "https://docs.mistral.ai/getting-started/models/models_overview/")
  ]),
  preset("kimi", "Kimi / Moonshot", "https://api.moonshot.ai/v1", "Kimi reasoning and coding models", false, [
    dynamicModel("kimi-k2.5", "Kimi K2.5", "kimi", "https://platform.moonshot.ai/docs"),
    dynamicModel("moonshot-v1-128k", "Moonshot V1 128K", "kimi", "https://platform.moonshot.ai/docs"),
    dynamicModel("kimi-latest", "Kimi Latest", "kimi", "https://platform.moonshot.ai/docs")
  ]),
  preset("groq", "Groq", "https://api.groq.com/openai/v1", "Low-latency inference", false, [
    model("llama-3.1-8b-instant", "Llama 3.1 8B Instant", "groq", 131072, 131072, "https://console.groq.com/docs/model/llama-3.1-8b-instant", ["chat", "fast-edits"]),
    model("openai/gpt-oss-120b", "GPT-OSS 120B", "groq", 131072, 65536, "https://console.groq.com/docs/models", ["coding", "planning"]),
    dynamicModel("deepseek-r1-distill-llama-70b", "DeepSeek R1 Distill 70B", "groq", "https://console.groq.com/docs/models"),
    dynamicModel("llama-3.3-70b-versatile", "Llama 3.3 70B", "groq", "https://console.groq.com/docs/models")
  ]),
  preset("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "Multi-provider model gateway", false, [
    dynamicModel("openrouter/auto", "Auto router", "openrouter", "https://openrouter.ai/models"),
    dynamicModel("openrouter/free", "Free router", "openrouter", "https://openrouter.ai/models"),
    dynamicModel("anthropic/claude-sonnet-4.6", "Claude Sonnet 4.6", "openrouter", "https://openrouter.ai/models"),
    dynamicModel("openai/gpt-5.4", "GPT-5.4", "openrouter", "https://openrouter.ai/models"),
    dynamicModel("google/gemini-2.5-pro", "Gemini 2.5 Pro", "openrouter", "https://openrouter.ai/models"),
    dynamicModel("z-ai/glm-5.1", "GLM-5.1", "openrouter", "https://openrouter.ai/models")
  ]),
  preset("together", "Together AI", "https://api.together.ai/v1", "Hosted open-weight models", false, [
    dynamicModel("openai/gpt-oss-20b", "GPT-OSS 20B", "together", "https://docs.together.ai/docs/serverless-models"),
    dynamicModel("Qwen/Qwen3.5-397B-A17B", "Qwen 3.5 397B", "together", "https://docs.together.ai/docs/serverless-models"),
    dynamicModel("zai-org/GLM-5", "GLM-5", "together", "https://docs.together.ai/docs/serverless-models"),
    dynamicModel("deepseek-ai/DeepSeek-V3", "DeepSeek V3", "together", "https://docs.together.ai/docs/serverless-models"),
    dynamicModel("meta-llama/Llama-3.3-70B-Instruct-Turbo", "Llama 3.3 70B Turbo", "together", "https://docs.together.ai/docs/serverless-models")
  ]),
  preset("deepseek", "DeepSeek", "https://api.deepseek.com", "Long-context reasoning and coding", false, [
    model("deepseek-v4-pro", "DeepSeek V4 Pro", "deepseek", 1000000, 131072, "https://api-docs.deepseek.com/news/news260424", ["coding", "planning", "large-context"], "preview"),
    model("deepseek-v4-flash", "DeepSeek V4 Flash", "deepseek", 1000000, 131072, "https://api-docs.deepseek.com/news/news260424", ["coding", "fast-edits", "large-context"], "preview"),
    dynamicModel("deepseek-chat", "DeepSeek Chat", "deepseek", "https://api-docs.deepseek.com/"),
    dynamicModel("deepseek-reasoner", "DeepSeek Reasoner", "deepseek", "https://api-docs.deepseek.com/")
  ]),
  preset("xai", "xAI", "https://api.x.ai/v1", "Grok reasoning and coding", false, [
    model("grok-4.3", "Grok 4.3", "xai", 1000000, 131072, "https://docs.x.ai/developers/pricing", ["coding", "planning", "large-context"]),
    model("grok-build-0.1", "Grok Build 0.1", "xai", 262144, 65536, "https://docs.x.ai/developers/pricing", ["coding", "fast-edits"]),
    dynamicModel("grok-3-mini", "Grok 3 Mini", "xai", "https://docs.x.ai/developers/models"),
    dynamicModel("grok-2-vision", "Grok 2 Vision", "xai", "https://docs.x.ai/developers/models")
  ]),
  preset("perplexity", "Perplexity", "https://api.perplexity.ai/v1", "Grounded search and frontier routing", false, [
    model("perplexity/sonar", "Sonar", "perplexity", 131072, 8192, "https://docs.perplexity.ai/docs/sonar/models/sonar", ["chat", "large-context"]),
    dynamicModel("perplexity/sonar-pro", "Sonar Pro", "perplexity", "https://docs.perplexity.ai/docs/sonar/models"),
    dynamicModel("perplexity/r1-1776", "R1 1776", "perplexity", "https://docs.perplexity.ai/docs/sonar/models")
  ]),
  preset("cerebras", "Cerebras", "https://api.cerebras.ai/v1", "High-speed open model inference", false, [
    model("zai-glm-4.7", "GLM 4.7", "cerebras", 131072, 40000, "https://inference-docs.cerebras.ai/resources/glm-47-migration", ["coding", "fast-edits"]),
    model("gpt-oss-120b", "GPT-OSS 120B", "cerebras", 131072, 65536, "https://inference-docs.cerebras.ai/models/overview", ["coding", "planning"]),
    dynamicModel("llama-4-scout-17b-16e-instruct", "Llama 4 Scout", "cerebras", "https://inference-docs.cerebras.ai/models/overview"),
    dynamicModel("qwen-3-235b-a22b-thinking-2507", "Qwen 3 235B Thinking", "cerebras", "https://inference-docs.cerebras.ai/models/overview")
  ]),
  preset("fireworks", "Fireworks AI", "https://api.fireworks.ai/inference/v1", "Fast serverless model hosting", false, [
    model("accounts/fireworks/routers/kimi-k2p6-turbo", "Kimi K2.6 Turbo", "fireworks", 256000, 256000, "https://docs.fireworks.ai/firepass", ["coding", "planning", "large-context"], "preview"),
    dynamicModel("accounts/fireworks/models/qwen3-coder-480b-a35b-instruct", "Qwen3 Coder", "fireworks", "https://docs.fireworks.ai/models/"),
    dynamicModel("accounts/fireworks/models/deepseek-v3", "DeepSeek V3", "fireworks", "https://docs.fireworks.ai/models/")
  ]),
  preset("sambanova", "SambaNova", "https://api.sambanova.ai/v1", "Fast open-model inference", false, [
    dynamicModel("Meta-Llama-3.3-70B-Instruct", "Llama 3.3 70B", "sambanova", "https://docs.sambanova.ai/cloud/docs/get-started/overview"),
    dynamicModel("DeepSeek-R1", "DeepSeek R1", "sambanova", "https://docs.sambanova.ai/cloud/docs/get-started/overview"),
    dynamicModel("Qwen3-32B", "Qwen3 32B", "sambanova", "https://docs.sambanova.ai/cloud/docs/get-started/overview")
  ]),
  preset("nvidia", "NVIDIA NIM", "https://integrate.api.nvidia.com/v1", "NVIDIA-hosted model endpoints", false, [
    dynamicModel("meta/llama-3.3-70b-instruct", "Llama 3.3 70B", "nvidia", "https://build.nvidia.com/models"),
    dynamicModel("qwen/qwen3-coder-480b-a35b-instruct", "Qwen3 Coder", "nvidia", "https://build.nvidia.com/models"),
    dynamicModel("deepseek-ai/deepseek-r1", "DeepSeek R1", "nvidia", "https://build.nvidia.com/models"),
    dynamicModel("mistralai/devstral-small-2507", "Devstral Small", "nvidia", "https://build.nvidia.com/models")
  ]),
  preset("ollama", "Ollama", "http://localhost:11434/v1", "Private models on this device", true, [
    dynamicModel("qwen2.5-coder", "Qwen 2.5 Coder", "ollama", "https://ollama.com/library"),
    dynamicModel("deepseek-coder-v2", "DeepSeek Coder V2", "ollama", "https://ollama.com/library"),
    dynamicModel("llama3.2", "Llama 3.2", "ollama", "https://ollama.com/library"),
    dynamicModel("qwen3", "Qwen 3", "ollama", "https://ollama.com/library"),
    dynamicModel("devstral", "Devstral", "ollama", "https://ollama.com/library")
  ]),
  preset("lmstudio", "LM Studio", "http://localhost:1234/v1", "Local OpenAI-compatible server", true, [dynamicModel("local-model", "Loaded local model", "lmstudio", "https://lmstudio.ai/docs")]),
  preset("custom-openai-compatible", "Custom endpoint", "http://localhost:8080/v1", "Any OpenAI-compatible endpoint", true, [])
];

function model(id: string, displayName: string, providerId: string, contextWindow: number, maxOutputTokens: number, contextSourceUrl: string, recommendedFor: LLMModelConfig["recommendedFor"], lifecycle: LLMModelConfig["lifecycle"] = "stable"): LLMModelConfig {
  return { id, displayName, providerId, contextWindow, maxOutputTokens, contextSourceUrl, contextVerifiedAt: "2026-06-28", recommendedFor, lifecycle };
}

function dynamicModel(id: string, displayName: string, providerId: string, contextSourceUrl: string): LLMModelConfig {
  return { id, displayName, providerId, contextSourceUrl, lifecycle: "dynamic", recommendedFor: ["chat", "coding"] };
}

function preset(id: LLMProviderType, name: string, baseUrl: string, description: string, isLocal: boolean, models: LLMModelConfig[]): ProviderPreset {
  return { id, name, baseUrl, description, isLocal, iconId: id === "custom-openai-compatible" ? "custom" : id, models };
}

export function getProviderPreset(id: LLMProviderType): ProviderPreset | undefined {
  return providerPresets.find((provider) => provider.id === id);
}

export function listVerifiedModels(): LLMModelConfig[] {
  return providerPresets.flatMap((provider) => provider.models ?? []);
}

export function defaultLimitsForModel(modelId: string): ModelRuntimeLimits {
  const metadata = listVerifiedModels().find((candidate) => candidate.id === modelId);
  const context = metadata?.contextWindow ?? 131072;
  const output = Math.min(metadata?.maxOutputTokens ?? 16384, context);
  return { maxContextTokens: Math.min(context, 131072), maxOutputTokens: output, requestsPerMinute: 30, tokensPerMinute: Math.min(context * 2, 500000) };
}

export type ModelRole = "chat" | "fastEdit" | "reasoning" | "largeContext" | "localPrivate" | "embeddings";

export interface ModelRoutingProfile {
  [role: string]: string | undefined;
  chat?: string;
  fastEdit?: string;
  reasoning?: string;
  largeContext?: string;
  localPrivate?: string;
  embeddings?: string;
}

export function describeProvider(provider: LLMProviderConfig): string {
  return `${provider.name} (${provider.type})`;
}

export function isLocalProvider(type: LLMProviderType): boolean {
  return type === "ollama" || type === "lmstudio" || type === "custom-openai-compatible";
}

export function providerLabel(type: LLMProviderType): string {
  const preset = providerPresets.find((item) => item.id === type);
  return preset?.name ?? type;
}

export function buildDefaultRoutingProfile(): ModelRoutingProfile {
  return {
    chat: "openai/gpt-4.1",
    fastEdit: "mistral/devstral",
    reasoning: "openai/o3",
    largeContext: "gemini/gemini-1.5-pro",
    localPrivate: "ollama/qwen2.5-coder",
    embeddings: "openai/text-embedding-3-large"
  };
}

export function summarizeRouting(profile: ModelRoutingProfile): string[] {
  return Object.entries(profile)
    .filter((entry): entry is [ModelRole, string] => Boolean(entry[1]))
    .map(([role, model]) => `${role}: ${model}`);
}

export interface RoutingRequest {
  /** The job the model is being asked to do. Mirrors a profile role. */
  role?: ModelRole;
  /**
   * Hint about how demanding the work is. Lifts the request up the priority
   * chain (e.g. a large edit upgrade to the reasoning model) before fallback.
   */
  intent?: "fast" | "balanced" | "heavy";
  /** Names a specific model id ("provider/model") and bypasses routing. */
  overrideModel?: string;
}

export interface RoutingResolution {
  /** The model id selected for this request, in "provider/model" form. */
  model: string;
  /** The role the resolution was made under. */
  role: ModelRole;
  /** Whether resolution used the override, the profile, or a fallback. */
  source: "override" | "profile" | "fallback";
  /** Models tried first but unavailable, in order. Empty on a clean hit. */
  skipped: string[];
}

/**
 * Resolve a request to a single model using the profile, with a deterministic
 * fallback chain when the primary model for a role is unavailable. Pure and
 * side-effect free; callers decide availability (e.g. {@link probeProvider}).
 */
export function resolveModel(
  request: RoutingRequest,
  profile: ModelRoutingProfile,
  isAvailable: (model: string) => boolean = () => true
): RoutingResolution {
  const role = request.role ?? "chat";
  const chain = buildFallbackChain(role, profile);

  if (request.overrideModel) {
    return { model: request.overrideModel, role, source: "override", skipped: [] };
  }

  const skipped: string[] = [];
  for (const candidate of chain) {
    if (isAvailable(candidate)) {
      return {
        model: candidate,
        role,
        source: candidate === chain[0] ? "profile" : "fallback",
        skipped
      };
    }
    skipped.push(candidate);
  }

  // Last resort: assume the primary is reachable and let the request fail at
  // the network layer with a real error rather than silently no-opping here.
  return { model: chain[0], role, source: "profile", skipped };
}

function buildFallbackChain(role: ModelRole, profile: ModelRoutingProfile): string[] {
  const primary = profile[role];
  const chain: string[] = [];
  if (primary) {
    chain.push(primary);
  }
  // Prefer same-bucket neighbours, then a sensible cross-role order.
  const order: ModelRole[] = ["chat", "fastEdit", "reasoning", "largeContext", "localPrivate", "embeddings"];
  for (const fallbackRole of order) {
    const candidate = profile[fallbackRole];
    if (candidate && !chain.includes(candidate)) {
      chain.push(candidate);
    }
  }
  return chain.length
    ? chain
    : [profile.chat ?? "openai/gpt-4.1"].filter(Boolean) as string[];
}

export interface ProbeOptions {
  /** Base URL of an OpenAI-compatible endpoint, e.g. https://api.openai.com/v1. */
  baseUrl: string;
  /** Bearer key sent as Authorization. May be empty for local servers. */
  apiKey?: string;
  /** Per-request timeout in milliseconds. Defaults to 8000. */
  timeoutMs?: number;
  /** fetch implementation; injected so this stays free of platform globals. */
  fetchImpl?: typeof fetch;
}

export interface ProbeResult {
  ok: boolean;
  /** HTTP status, or 0 for transport/parse failures. */
  status: number;
  /** Human-readable detail for surfacing in UI or logs. */
  detail: string;
  /** Model ids observed in a successful /models response, if any. */
  models: string[];
}

/**
 * Probe an OpenAI-compatible endpoint with a lightweight GET /models request.
 * Returns a structured result instead of throwing so callers can render the
 * outcome. This does NOT perform a chat completion; it only checks reachability
 * and that the key is accepted for listing models.
 */
export async function probeProvider(options: ProbeOptions): Promise<ProbeResult> {
  const { baseUrl, apiKey, fetchImpl = fetch } = options;
  const trimmed = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return { ok: false, status: 0, detail: "No base URL configured.", models: [] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const response = await fetchImpl(`${trimmed}/models`, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, detail: "API key rejected.", models: [] };
    }
    if (response.status === 404) {
      // Some local servers expose /v1 but not /models. Still reachable.
      return { ok: true, status: response.status, detail: "Endpoint reachable; model listing not supported.", models: [] };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, detail: `HTTP ${response.status} ${response.statusText}`, models: [] };
    }

    const payload = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | null;
    const models = Array.isArray(payload?.data)
      ? payload!.data.map((entry) => entry.id).filter((id): id is string => typeof id === "string" && Boolean(id))
      : [];
    return {
      ok: true,
      status: response.status,
      detail: models.length ? `Reachable; ${models.length} model(s) listed.` : "Reachable.",
      models
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      detail: message.includes("abort") ? "Timed out." : `Connection failed: ${message}`,
      models: []
    };
  } finally {
    clearTimeout(timer);
  }
}
