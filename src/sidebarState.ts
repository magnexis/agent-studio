import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { ProjectConfig } from "./projectConfig";
import { readProjectConfig } from "./projectConfig";

export interface SidebarWorkflowTemplate {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  modelPreference: string;
  requiredContext: string[];
  safetyMode: "manual" | "semi-auto" | "full-auto" | "read-only";
}

export interface SidebarWorkspaceSnapshot {
  configPath?: string;
  configSummary: string[];
  workflowTemplates: SidebarWorkflowTemplate[];
  quickGoalPrompts: string[];
}

export const sidebarWorkflowTemplates: SidebarWorkflowTemplate[] = [
  {
    id: "review-pr",
    name: "Review This PR",
    description: "Summarize bugs, regressions, and missing tests.",
    promptTemplate: "Review the current diff and list concrete findings first.",
    modelPreference: "openai/o3",
    requiredContext: ["git diff", "changed files"],
    safetyMode: "manual"
  },
  {
    id: "generate-tests",
    name: "Generate Tests",
    description: "Create focused tests around the changed behavior.",
    promptTemplate: "Write or improve tests for the files I provide.",
    modelPreference: "openai/gpt-4.1",
    requiredContext: ["source files"],
    safetyMode: "manual"
  },
  {
    id: "refactor-react",
    name: "Refactor React Component",
    description: "Improve structure while preserving behavior.",
    promptTemplate: "Refactor the selected React component conservatively.",
    modelPreference: "anthropic/claude",
    requiredContext: ["selected component"],
    safetyMode: "manual"
  },
  {
    id: "security-check",
    name: "Find Security Issues",
    description: "Scan for risky code paths and unsafe defaults.",
    promptTemplate: "Review for security issues and explain fixes in order of severity.",
    modelPreference: "openai/o3",
    requiredContext: ["workspace summary"],
    safetyMode: "manual"
  }
];

export function createSidebarWorkspaceSnapshot(): SidebarWorkspaceSnapshot {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const projectConfig = readProjectConfig();
  const configPath = workspaceFolder ? path.join(workspaceFolder.uri.fsPath, ".magnexis", "config.json") : undefined;
  const configExists = Boolean(configPath && fs.existsSync(configPath));

  return {
    configPath: configExists ? configPath : undefined,
    configSummary: summarizeProjectConfig(projectConfig, configExists),
    workflowTemplates: sidebarWorkflowTemplates,
    quickGoalPrompts: [
      "Review this diff",
      "Generate tests for current file",
      "Refactor selected code",
      "Find security issues"
    ]
  };
}

export function summarizeProjectConfig(projectConfig: ProjectConfig | undefined, configExists: boolean): string[] {
  return [
    configExists ? "Workspace config: .magnexis/config.json" : "Workspace config: not created yet",
    `Default provider: ${projectConfig?.defaultProvider ?? "workspace default"}`,
    `Default model: ${projectConfig?.defaultModel ?? "provider default"}`,
    `Approval mode: ${projectConfig?.approvalMode ?? "manual"}`,
    `Auto apply: ${projectConfig?.autoApply ? "on" : "off"}`,
    `Auto commands: ${projectConfig?.autoRunCommands ? "on" : "off"}`,
    `Indexing: ${projectConfig?.indexing?.enabled === false ? "off" : "on"}`,
    `Context: ${projectConfig?.context?.maxFiles ?? 50} files / ${projectConfig?.context?.maxFileSizeKb ?? 250} KB`
  ];
}
