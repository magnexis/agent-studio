import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";
import { loadAuthEnvironment, validateAuthEnvironment } from "../packages/auth/src/index";
import { describeMagnexisConfigSources, loadMagnexisConfigFromWorkspace } from "../packages/config/src/index";
import { resolveIndexerConfig, shouldIgnorePath } from "../packages/indexer/src/index";
import { getProviderPreset, providerPresets } from "../packages/llm-router/src/index";
import type { LLMProviderType } from "../packages/types/src/index";
import { systemPrompt } from "./systemPrompt";

type CommandName = "help" | "status" | "providers" | "doctor" | "run";

interface ParsedArgs {
  command: CommandName;
  params: string[];
  flags: Record<string, string | boolean>;
}

interface CliRoute {
  providerId: string;
  providerLabel: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  apiKeySource?: string;
  workspaceRoot: string;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  switch (parsed.command) {
    case "help":
      printHelp();
      return;
    case "status":
      printStatus(resolveWorkspaceRoot(parsed));
      return;
    case "providers":
      printProviders(parsed.params[0]);
      return;
    case "doctor":
      printDoctor(resolveWorkspaceRoot(parsed));
      return;
    case "run":
      await runPrompt(parsed);
      return;
    default:
      printHelp();
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const params: string[] = [];
  let command: CommandName = "help";
  let commandSet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith("--")) {
      const [rawKey, inlineValue] = value.slice(2).split("=", 2);
      if (inlineValue !== undefined) {
        flags[rawKey] = inlineValue;
        continue;
      }
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        flags[rawKey] = next;
        index += 1;
      } else {
        flags[rawKey] = true;
      }
      continue;
    }

    if (!commandSet && isCommandName(value)) {
      command = value;
      commandSet = true;
      continue;
    }

    if (!commandSet) {
      command = "run";
      commandSet = true;
    }
    params.push(value);
  }

  return { command, params, flags };
}

function isCommandName(value: string): value is CommandName {
  return value === "help" || value === "status" || value === "providers" || value === "doctor" || value === "run";
}

function printHelp(): void {
  process.stdout.write(`Magnexis CLI

Usage:
  magnexis status [--workspace <path>]
  magnexis providers [provider-id]
  magnexis doctor [--workspace <path>]
  magnexis run "<prompt>" [--workspace <path>] [--provider <id>] [--model <id>] [--api <responses|chat-completions>] [--base-url <url>] [--api-key <value>] [--json]

Examples:
  magnexis status
  magnexis providers openai
  magnexis doctor --workspace .
  magnexis run "Review the current workspace and list the top risks."
  magnexis run "Summarize this repo" --provider openai --api responses

Environment:
  MAGNEXIS_PROVIDER
  MAGNEXIS_MODEL
  MAGNEXIS_BASE_URL
  MAGNEXIS_API_KEY
  SUPABASE_URL
  SUPABASE_ANON_KEY
  AUTH_CALLBACK_URL
  AUTH_CALLBACK_PORT
`);
}

function printStatus(workspaceRoot: string): void {
  const config = loadMagnexisConfigFromWorkspace(workspaceRoot);
  const indexer = resolveIndexerConfig(workspaceRoot);
  const route = resolveCliRoute(workspaceRoot, {});
  const files = listWorkspaceFiles(workspaceRoot, indexer.ignore, 6);
  const authEnv = loadAuthEnvironment({ cwd: workspaceRoot, env: process.env });
  const authIssues = validateAuthEnvironment(authEnv);

  process.stdout.write(`Magnexis status
Workspace: ${workspaceRoot}
Provider: ${route.providerLabel} (${route.providerId})
Model: ${route.model}
Base URL: ${route.baseUrl}
API key: ${route.apiKey ? `present via ${route.apiKeySource}` : "missing"}
Approval mode: ${config.approvalMode}
Auto apply: ${config.autoApply ? "enabled" : "disabled"}
Auto commands: ${config.autoRunCommands ? "enabled" : "disabled"}
Indexing: ${indexer.enabled ? "enabled" : "disabled"} / ${indexer.ignore.length} ignore rules
Config sources: ${describeMagnexisConfigSources(workspaceRoot).join(", ") || "default only"}
Auth env: ${authIssues.length ? "incomplete" : "ready"}
Workspace sample:
${files.map((filePath) => `  - ${filePath}`).join("\n") || "  - no indexed files found"}
`);
}

function printProviders(providerId?: string): void {
  if (!providerId) {
    process.stdout.write(`Magnexis providers
${providerPresets.map((provider) => `- ${provider.id}: ${provider.name} / ${provider.isLocal ? "local" : "cloud"} / ${(provider.models ?? []).length} models`).join("\n")}
`);
    return;
  }

  const provider = getProviderPreset(mapProviderId(providerId) as LLMProviderType);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  process.stdout.write(`${provider.name}
Id: ${provider.id}
Type: ${provider.isLocal ? "local" : "cloud"}
Base URL: ${provider.baseUrl ?? "not set"}
Description: ${provider.description ?? "none"}
Models:
${(provider.models ?? []).map((model) => `  - ${model.id} / ${model.displayName}${model.contextWindow ? ` / ${model.contextWindow.toLocaleString()} context` : ""}`).join("\n") || "  - no pinned models"}
`);
}

function printDoctor(workspaceRoot: string): void {
  const config = loadMagnexisConfigFromWorkspace(workspaceRoot);
  const indexer = resolveIndexerConfig(workspaceRoot);
  const authEnv = loadAuthEnvironment({ cwd: workspaceRoot, env: process.env });
  const authIssues = validateAuthEnvironment(authEnv);
  const route = resolveCliRoute(workspaceRoot, {});
  const checks = [
    { name: "Workspace config", ok: Boolean(config.defaultProvider && config.defaultModel), detail: `${config.defaultProvider} / ${config.defaultModel}` },
    { name: "Auth environment", ok: authIssues.length === 0, detail: authIssues.length ? authIssues.join("; ") : authEnv.AUTH_CALLBACK_URL },
    { name: "CLI route", ok: Boolean(route.baseUrl), detail: `${route.providerLabel} -> ${route.baseUrl}` },
    { name: "API key", ok: route.providerId === "ollama" || route.providerId === "lmstudio" || route.providerId === "custom-openai-compatible" || Boolean(route.apiKey), detail: route.apiKey ? `present via ${route.apiKeySource}` : "missing for selected provider" },
    { name: "Indexer", ok: indexer.enabled, detail: `${indexer.maxFiles} files max / ${indexer.ignore.length} ignore rules` }
  ];

  process.stdout.write(`Magnexis doctor
${checks.map((check) => `${check.ok ? "[ok]" : "[warn]"} ${check.name}: ${check.detail}`).join("\n")}
`);
}

async function runPrompt(parsed: ParsedArgs): Promise<void> {
  const prompt = parsed.params.join(" ").trim();
  if (!prompt) {
    throw new Error("Provide a prompt to run. Example: magnexis run \"Review this workspace.\"");
  }

  const workspaceRoot = resolveWorkspaceRoot(parsed);
  const route = resolveCliRoute(workspaceRoot, parsed.flags);
  if (!route.baseUrl) {
    throw new Error("No provider base URL is configured for this CLI run.");
  }
  if (!route.apiKey && route.providerId !== "ollama" && route.providerId !== "lmstudio" && route.providerId !== "custom-openai-compatible") {
    throw new Error("No API key found. Set MAGNEXIS_API_KEY or a provider-specific API key environment variable.");
  }

  const workspaceContext = buildWorkspaceContext(workspaceRoot);
  const apiMode = resolveApiMode(route.providerId, parsed.flags.api);
  const content = apiMode === "responses"
    ? await runResponsesPrompt(route, prompt, workspaceContext)
    : await runChatCompletionsPrompt(route, prompt, workspaceContext);

  if (parsed.flags.json) {
    process.stdout.write(JSON.stringify({
      provider: route.providerId,
      model: route.model,
      workspaceRoot,
      api: apiMode,
      content
    }, null, 2));
    return;
  }

  process.stdout.write(`Magnexis run
Provider: ${route.providerLabel}
Model: ${route.model}
API: ${apiMode}
Workspace: ${workspaceRoot}

${content}
`);
}

function resolveApiMode(providerId: string, requestedMode: string | boolean | undefined): "responses" | "chat-completions" {
  if (requestedMode === "responses" || requestedMode === "chat-completions") {
    return requestedMode;
  }
  return providerId === "openai" ? "responses" : "chat-completions";
}

async function runResponsesPrompt(route: CliRoute, prompt: string, workspaceContext: string): Promise<string> {
  const client = new OpenAI({
    apiKey: route.apiKey ?? "not-required",
    baseURL: route.baseUrl.replace(/\/+$/, "")
  });

  const response = await client.responses.create({
    model: route.model,
    instructions: systemPrompt,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${prompt}\n\n<context>\n${workspaceContext}\n</context>`
          }
        ]
      }
    ]
  });

  const content = response.output_text?.trim();
  if (!content) {
    throw new Error("The provider returned an empty response.");
  }
  return content;
}

async function runChatCompletionsPrompt(route: CliRoute, prompt: string, workspaceContext: string): Promise<string> {
  const response = await fetch(`${route.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: route.model,
      temperature: 0.2,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${prompt}\n\n<context>\n${workspaceContext}\n</context>` }
      ]
    })
  });

  const raw = await response.json().catch(() => ({})) as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(raw.error?.message ?? `${response.status} ${response.statusText}`);
  }

  const content = raw.choices?.[0]?.message?.content ?? raw.choices?.[0]?.text ?? "";
  if (!content.trim()) {
    throw new Error("The provider returned an empty response.");
  }
  return content;
}

function resolveWorkspaceRoot(parsed: { flags: Record<string, string | boolean> }): string {
  const workspaceFlag = parsed.flags.workspace;
  return path.resolve(typeof workspaceFlag === "string" ? workspaceFlag : process.cwd());
}

function resolveCliRoute(workspaceRoot: string, flags: Record<string, string | boolean>): CliRoute {
  const config = loadMagnexisConfigFromWorkspace(workspaceRoot);
  const requestedProviderId = String(flags.provider || process.env.MAGNEXIS_PROVIDER || config.defaultProvider || "zai");
  const providerId = mapProviderId(requestedProviderId);
  const provider = getProviderPreset(providerId as LLMProviderType);
  if (!provider) {
    throw new Error(`Unknown provider route: ${requestedProviderId}`);
  }
  const model = String(flags.model || process.env.MAGNEXIS_MODEL || config.defaultModel || provider.models?.[0]?.id || "");
  const baseUrl = String(flags["base-url"] || process.env.MAGNEXIS_BASE_URL || provider.baseUrl || "").trim();
  const { apiKey, source } = resolveApiKey(provider.id, flags["api-key"]);
  return {
    providerId: provider.id,
    providerLabel: provider.name,
    model,
    baseUrl,
    apiKey,
    apiKeySource: source,
    workspaceRoot
  };
}

function resolveApiKey(providerId: string, explicitFlag: string | boolean | undefined): { apiKey?: string; source?: string } {
  if (typeof explicitFlag === "string" && explicitFlag.trim()) {
    return { apiKey: explicitFlag.trim(), source: "--api-key" };
  }

  const envCandidates = [
    "MAGNEXIS_API_KEY",
    providerEnvName(providerId)
  ].filter(Boolean) as string[];

  for (const envName of envCandidates) {
    const value = process.env[envName];
    if (value?.trim()) {
      return { apiKey: value.trim(), source: envName };
    }
  }
  return {};
}

function providerEnvName(providerId: string): string | undefined {
  const map: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    zai: "ZAI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    kimi: "KIMI_API_KEY",
    groq: "GROQ_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    together: "TOGETHER_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    xai: "XAI_API_KEY",
    perplexity: "PERPLEXITY_API_KEY",
    cerebras: "CEREBRAS_API_KEY",
    fireworks: "FIREWORKS_API_KEY",
    sambanova: "SAMBANOVA_API_KEY",
    nvidia: "NVIDIA_API_KEY"
  };
  return map[providerId];
}

function mapProviderId(value: string): string {
  return value === "custom" ? "custom-openai-compatible" : value;
}

function buildWorkspaceContext(workspaceRoot: string): string {
  const config = loadMagnexisConfigFromWorkspace(workspaceRoot);
  const indexer = resolveIndexerConfig(workspaceRoot);
  const files = listWorkspaceFiles(workspaceRoot, indexer.ignore, 24);
  return [
    `workspace: ${workspaceRoot}`,
    `default provider: ${config.defaultProvider}`,
    `default model: ${config.defaultModel}`,
    `approval mode: ${config.approvalMode}`,
    `auto apply: ${config.autoApply ? "enabled" : "disabled"}`,
    `indexed sample files:`,
    ...files.map((filePath) => `- ${filePath}`)
  ].join("\n");
}

function listWorkspaceFiles(workspaceRoot: string, ignoreList: string[], maxFiles: number): string[] {
  const results: string[] = [];

  function walk(currentPath: string): void {
    if (results.length >= maxFiles) {
      return;
    }
    const entries = safeReadDir(currentPath);
    for (const entry of entries) {
      if (results.length >= maxFiles) {
        break;
      }
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
      if (!relativePath || shouldIgnorePath(relativePath, ignoreList)) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  }

  walk(workspaceRoot);
  return results;
}

function safeReadDir(directoryPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

main().catch((error) => {
  process.stderr.write(`Magnexis CLI error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
