export type LLMProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "zai"
  | "kimi"
  | "mistral"
  | "groq"
  | "openrouter"
  | "together"
  | "deepseek"
  | "xai"
  | "perplexity"
  | "cerebras"
  | "fireworks"
  | "sambanova"
  | "nvidia"
  | "ollama"
  | "lmstudio"
  | "custom-openai-compatible";

export interface LLMModelConfig {
  id: string;
  displayName: string;
  providerId: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  contextSourceUrl?: string;
  contextVerifiedAt?: string;
  lifecycle?: "stable" | "preview" | "dynamic";
  inputCostPerMillion?: number;
  outputCostPerMillion?: number;
  recommendedFor?: Array<"chat" | "coding" | "planning" | "fast-edits" | "large-context" | "local-private">;
}

export interface ModelRuntimeLimits {
  maxContextTokens: number;
  maxOutputTokens: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface LLMProviderConfig {
  id: string;
  name: string;
  type: LLMProviderType;
  baseUrl?: string;
  apiKey?: string;
  models: LLMModelConfig[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  isLocal: boolean;
}

export type ApprovalMode = "manual" | "semi-auto" | "full-auto" | "read-only";

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  run(input: TInput, context: AgentContext): Promise<TOutput>;
}

export interface AgentContext {
  workspacePath?: string;
  selectedText?: string;
  activeFile?: string;
  attachedFiles?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  modelPreference?: string;
  requiredContext?: string[];
  safetyMode?: ApprovalMode;
}

export type UpdateSeverity =
  | "info"
  | "warning"
  | "critical-update"
  | "security-update"
  | "provider-update"
  | "desktop-app-update"
  | "vscode-extension-update";

export type UpdatePackageType = "desktop" | "vscode-extension" | "web-dashboard" | "platform";

export interface UpdateManifest {
  product: string;
  currentVersion: string;
  latestVersion: string;
  minimumRequiredVersion: string;
  severity: UpdateSeverity;
  message: string;
  downloadUrl?: string;
  releaseNotesUrl?: string;
  sourceUrl?: string;
  publishedAt?: string;
  packageType: UpdatePackageType;
  checksum?: string;
  isCritical: boolean;
  updateNotes?: string[];
}

export interface UpdateSourceConfig {
  githubReleasesUrl?: string;
  vscodeMarketplaceUrl?: string;
  desktopManifestUrl?: string;
  internalManifestUrl?: string;
}
