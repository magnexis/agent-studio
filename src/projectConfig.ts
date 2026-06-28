import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { ApprovalMode } from "./tools";
import { isProviderId, type ProviderId } from "./provider";

export interface ProjectConfig {
  defaultProvider?: string;
  defaultModel?: string;
  approvalMode?: "manual" | "semi-auto" | "full-auto" | "read-only";
  autoApply?: boolean;
  autoRunCommands?: boolean;
  indexing?: {
    enabled?: boolean;
    ignore?: string[];
  };
  context?: {
    maxFiles?: number;
    maxFileSizeKb?: number;
  };
}

export function readProjectConfig(): ProjectConfig | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return undefined;
  }

  const configPath = path.join(workspaceFolder.uri.fsPath, ".magnexis", "config.json");
  try {
    if (!fs.existsSync(configPath)) {
      return undefined;
    }
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as ProjectConfig;
    return parsed;
  } catch {
    return undefined;
  }
}

export function resolveDefaultProvider(fallback: ProviderId): ProviderId {
  const projectConfig = readProjectConfig();
  const candidate = projectConfig?.defaultProvider;
  if (isProviderId(candidate)) {
    return candidate;
  }
  return fallback;
}

export function resolveDefaultModel(fallback: string): string {
  return readProjectConfig()?.defaultModel?.trim() || fallback;
}

export function resolveDefaultApprovalMode(fallback: ApprovalMode): ApprovalMode {
  const projectConfig = readProjectConfig();
  switch (projectConfig?.approvalMode) {
    case "read-only":
      return "chat";
    case "manual":
    case "semi-auto":
      return "agent";
    case "full-auto":
      return "fullAccess";
    default:
      return fallback;
  }
}
