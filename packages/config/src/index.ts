import type { ApprovalMode, ModelRuntimeLimits } from "../../types/src/index";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface MagnexisConfig {
  version?: number;
  defaultProvider: string;
  defaultModel: string;
  approvalMode: ApprovalMode;
  autoApply: boolean;
  autoRunCommands: boolean;
  indexing: {
    enabled: boolean;
    ignore: string[];
  };
  context: {
    maxFiles: number;
    maxFileSizeKb: number;
  };
  modelLimits: Record<string, ModelRuntimeLimits>;
}

export const defaultMagnexisConfig: MagnexisConfig = {
  version: 1,
  defaultProvider: "openai",
  defaultModel: "glm-5.1",
  approvalMode: "manual",
  autoApply: false,
  autoRunCommands: false,
  indexing: {
    enabled: true,
    ignore: ["node_modules", ".git", "dist", "build"]
  },
  context: {
    maxFiles: 50,
    maxFileSizeKb: 250
  },
  modelLimits: {}
};

export const magnexisConfigFileName = "config.json";
export const magnexisConfigFolderName = ".magnexis";
export const magnexisGlobalConfigFolder = path.join(os.homedir(), magnexisConfigFolderName);

export function resolveMagnexisConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, magnexisConfigFolderName, magnexisConfigFileName);
}

export function resolveMagnexisGlobalConfigPath(): string {
  return path.join(magnexisGlobalConfigFolder, magnexisConfigFileName);
}

export function loadMagnexisConfigFromFile(configPath: string): MagnexisConfig | undefined {
  if (!fs.existsSync(configPath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return normalizeMagnexisConfig(JSON.parse(raw) as Partial<MagnexisConfig>);
  } catch {
    return undefined;
  }
}

export function normalizeMagnexisConfig(input: Partial<MagnexisConfig>): MagnexisConfig {
  return {
    version: typeof input.version === "number" ? input.version : defaultMagnexisConfig.version,
    defaultProvider: input.defaultProvider?.trim() || defaultMagnexisConfig.defaultProvider,
    defaultModel: input.defaultModel?.trim() || defaultMagnexisConfig.defaultModel,
    approvalMode: isApprovalMode(input.approvalMode) ? input.approvalMode : defaultMagnexisConfig.approvalMode,
    autoApply: typeof input.autoApply === "boolean" ? input.autoApply : defaultMagnexisConfig.autoApply,
    autoRunCommands: typeof input.autoRunCommands === "boolean" ? input.autoRunCommands : defaultMagnexisConfig.autoRunCommands,
    indexing: {
      enabled: input.indexing?.enabled ?? defaultMagnexisConfig.indexing.enabled,
      ignore: uniqueStrings(input.indexing?.ignore?.filter(Boolean) ?? defaultMagnexisConfig.indexing.ignore)
    },
    context: {
      maxFiles: clampInteger(input.context?.maxFiles, defaultMagnexisConfig.context.maxFiles, 1, 1000),
      maxFileSizeKb: clampInteger(input.context?.maxFileSizeKb, defaultMagnexisConfig.context.maxFileSizeKb, 1, 10240)
    },
    modelLimits: normalizeModelLimits(input.modelLimits)
  };
}

export function loadMagnexisConfigFromWorkspace(workspaceRoot: string): MagnexisConfig {
  return mergeMagnexisConfigs(
    defaultMagnexisConfig,
    loadMagnexisConfigFromFile(resolveMagnexisGlobalConfigPath()),
    loadMagnexisConfigFromFile(resolveMagnexisConfigPath(workspaceRoot))
  );
}

export function describeMagnexisConfigSources(workspaceRoot?: string): string[] {
  const sources = [resolveMagnexisGlobalConfigPath()];
  if (workspaceRoot) {
    sources.push(resolveMagnexisConfigPath(workspaceRoot));
  }
  return sources.filter((filePath) => fs.existsSync(filePath));
}

export function mergeMagnexisConfigs(...configs: Array<MagnexisConfig | undefined>): MagnexisConfig {
  return configs.reduce<MagnexisConfig>((accumulator, next) => {
    if (!next) {
      return accumulator;
    }

    return normalizeMagnexisConfig({
      version: next.version ?? accumulator.version,
      defaultProvider: next.defaultProvider ?? accumulator.defaultProvider,
      defaultModel: next.defaultModel ?? accumulator.defaultModel,
      approvalMode: next.approvalMode ?? accumulator.approvalMode,
      autoApply: next.autoApply ?? accumulator.autoApply,
      autoRunCommands: next.autoRunCommands ?? accumulator.autoRunCommands,
      indexing: {
        enabled: next.indexing?.enabled ?? accumulator.indexing.enabled,
        ignore: [...accumulator.indexing.ignore, ...(next.indexing?.ignore ?? [])]
      },
      context: {
        maxFiles: next.context?.maxFiles ?? accumulator.context.maxFiles,
        maxFileSizeKb: next.context?.maxFileSizeKb ?? accumulator.context.maxFileSizeKb
      },
      modelLimits: { ...accumulator.modelLimits, ...(next.modelLimits ?? {}) }
    });
  }, defaultMagnexisConfig);
}

function normalizeModelLimits(value: unknown): Record<string, ModelRuntimeLimits> {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value as Record<string, Partial<ModelRuntimeLimits>>).reduce<Record<string, ModelRuntimeLimits>>((limits, [modelId, input]) => {
    if (!modelId.trim() || !input || typeof input !== "object") return limits;
    limits[modelId] = {
      maxContextTokens: clampInteger(input.maxContextTokens, 131072, 1024, 2000000),
      maxOutputTokens: clampInteger(input.maxOutputTokens, 16384, 256, 300000),
      requestsPerMinute: clampInteger(input.requestsPerMinute, 30, 1, 100000),
      tokensPerMinute: clampInteger(input.tokensPerMinute, 250000, 1000, 100000000)
    };
    limits[modelId].maxOutputTokens = Math.min(limits[modelId].maxOutputTokens, limits[modelId].maxContextTokens);
    return limits;
  }, {});
}

function isApprovalMode(value: unknown): value is ApprovalMode {
  return value === "manual" || value === "semi-auto" || value === "full-auto" || value === "read-only";
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
