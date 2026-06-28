import type { AgentContext, AgentTool, WorkflowTemplate } from "@magnexis/types";

export interface AgentTaskPlan {
  summary: string;
  steps: string[];
  safetyNotes: string[];
}

export function createAgentTaskPlan(goal: string): AgentTaskPlan {
  return {
    summary: goal.trim(),
    steps: [
      "Inspect relevant files.",
      "Draft a safe implementation plan.",
      "Request approval for edits or commands.",
      "Apply approved changes.",
      "Summarize verification results."
    ],
    safetyNotes: ["Keep changes small.", "Never modify files without approval."]
  };
}

export function summarizeContext(context: AgentContext): string {
  return [
    context.workspacePath ? `workspace: ${context.workspacePath}` : undefined,
    context.activeFile ? `file: ${context.activeFile}` : undefined,
    context.selectedText ? `selection: ${context.selectedText.length} chars` : undefined
  ].filter(Boolean).join(", ");
}

export function isWorkflowTemplate(value: WorkflowTemplate | undefined): value is WorkflowTemplate {
  return Boolean(value?.id && value.name && value.promptTemplate);
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "review-pr",
    name: "Review This PR",
    description: "Summarize risk, bugs, and follow-up fixes for a change set.",
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
    description: "Clean structure while preserving behavior.",
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

export function summarizeWorkflowTemplates(templates: WorkflowTemplate[] = workflowTemplates): string[] {
  return templates.map((template) => `${template.name}: ${template.description}`);
}

export type { AgentTool };
