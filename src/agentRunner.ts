import * as cp from "child_process";
import * as path from "path";
import * as vscode from "vscode";
import { extractWorkspaceEdit } from "./editParser";
import { loadInstructions } from "./instructions";
import { completeChat, ChatMessage } from "./llmClient";
import { getModel, getProviderConfig } from "./provider";
import { systemPrompt } from "./systemPrompt";
import { getApprovalMode, runTool, ToolRequest } from "./tools";
import { collectPromptContext, formatContext } from "./workspaceContext";

export interface AgentUpdate {
  type: "assistant" | "assistant_delta" | "tool" | "status";
  content: string;
  workspaceEdit?: ReturnType<typeof extractWorkspaceEdit>;
  toolCall?: AgentToolCallUpdate;
}

export interface AgentToolCallUpdate {
  id: string;
  tool: ToolRequest["tool"];
  args?: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  output?: string;
  requiresApproval: boolean;
}

export type AgentUpdateSink = (update: AgentUpdate) => void | Promise<void>;

export interface AgentSessionState {
  id: string;
  history: ChatMessage[];
  instructionsLoaded: boolean;
  goal?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface AgentTranscriptEntry {
  role: "user" | "assistant";
  content: string;
}

interface AgentAction {
  type: "tool" | "final";
  message?: string;
  tool?: ToolRequest["tool"];
  args?: Record<string, unknown>;
}

const actionPattern = /```(?:magnexis-action|json)\s*([\s\S]*?)```/i;

export class AgentSession {
  private readonly id: string;
  private readonly createdAt: number;
  private history: ChatMessage[];
  private instructionsLoaded: boolean;
  private goal: string | undefined;
  private updatedAt: number;

  constructor(state?: AgentSessionState) {
    this.id = state?.id ?? createThreadId();
    this.createdAt = state?.createdAt ?? Date.now();
    this.history = state?.history?.length ? state.history : [{ role: "system", content: systemPrompt }];
    this.instructionsLoaded = state?.instructionsLoaded ?? false;
    this.goal = state?.goal;
    this.updatedAt = state?.updatedAt ?? state?.createdAt ?? Date.now();
  }

  async send(prompt: string, apiKey: string, sink: AgentUpdateSink): Promise<void> {
    this.updatedAt = Date.now();
    await this.ensureInstructions();

    if (prompt.trim().startsWith("/review")) {
      prompt = await this.buildReviewPrompt(prompt);
    }

    const slashHandled = await this.tryHandleSlashCommand(prompt, sink);
    if (slashHandled) {
      return;
    }

    const context = await collectPromptContext(prompt);
    const contextText = formatContext(context);
    const reasoningEffort = vscode.workspace.getConfiguration("magnexis").get<string>("reasoningEffort", "medium");
    const goalText = this.goal ? `<goal>\n${this.goal}\n</goal>\n\n` : "";
    const effortText = `<reasoning_effort>${reasoningEffort}</reasoning_effort>\n\n`;
    const content = contextText
      ? `${goalText}${effortText}${prompt}\n\n<context>\n${contextText}\n</context>`
      : `${goalText}${effortText}${prompt}`;

    this.history.push({ role: "user", content });

    if (getApprovalMode() === "chat") {
      const completion = await completeChat(this.history, apiKey, {
        onTextDelta: async (delta) => {
          await sink({
            type: "assistant_delta",
            content: delta
          });
        }
      });
      this.history.push({ role: "assistant", content: completion.content });
      await sink({
        type: "assistant",
        content: completion.content,
        workspaceEdit: extractWorkspaceEdit(completion.content)
      });
      return;
    }

    const maxRounds = vscode.workspace.getConfiguration("magnexis").get<number>("maxToolRounds", 12);
    for (let round = 0; round < maxRounds; round += 1) {
      const completion = await completeChat(this.history, apiKey);
      this.history.push({ role: "assistant", content: completion.content });

      const action = parseAction(completion.content);
      if (!action) {
        await sink({
          type: "assistant",
          content: completion.content,
          workspaceEdit: extractWorkspaceEdit(completion.content)
        });
        return;
      }

      if (action.message) {
        await sink({ type: "status", content: action.message });
      }

      if (action.type === "final") {
        const finalMessage = action.message ?? completion.content;
        await sink({
          type: "assistant",
          content: finalMessage,
          workspaceEdit: extractWorkspaceEdit(completion.content)
        });
        return;
      }

      if (!action.tool) {
        await this.appendToolResult("Invalid action: missing tool name.");
        continue;
      }

      const toolCallId = `${this.id}-tool-${round + 1}`;
      const requiresApproval = action.tool === "run_command" || action.tool === "apply_edit";
      await sink({
        type: "tool",
        content: `${action.tool} ${JSON.stringify(action.args ?? {})}`,
        toolCall: {
          id: toolCallId,
          tool: action.tool,
          args: action.args,
          status: "running",
          requiresApproval
        }
      });
      const result = await runTool({ tool: action.tool, args: action.args });
      await sink({
        type: "tool",
        content: result.content,
        toolCall: {
          id: toolCallId,
          tool: action.tool,
          args: action.args,
          status: result.ok ? "completed" : "failed",
          output: limitToolOutput(result.content),
          requiresApproval
        }
      });
      await this.appendToolResult(JSON.stringify({
        tool: action.tool,
        ok: result.ok,
        content: result.content
      }));
    }

    const message = "Stopped because the maximum tool-round limit was reached. Ask me to continue if you want me to keep working.";
    this.history.push({ role: "assistant", content: message });
    await sink({ type: "assistant", content: message });
  }

  addContext(label: string, content: string): void {
    this.history.push({
      role: "user",
      content: `<pinned_context label="${label}">\n${content}\n</pinned_context>`
    });
    this.updatedAt = Date.now();
  }

  reset(): void {
    this.history = [
      { role: "system", content: systemPrompt }
    ];
    this.instructionsLoaded = false;
    this.goal = undefined;
    this.updatedAt = Date.now();
  }

  status(): string {
    const provider = getProviderConfig();
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "No workspace";
    return [
      `Thread: ${this.id}`,
      `Provider: ${provider.label}`,
      `Model: ${getModel()}`,
      `Mode: ${getApprovalMode()}`,
      `Reasoning: ${vscode.workspace.getConfiguration("magnexis").get<string>("reasoningEffort", "medium")}`,
      `Auto Context: ${vscode.workspace.getConfiguration("magnexis").get<boolean>("autoContext", true) ? "on" : "off"}`,
      `Goal: ${this.goal ?? "none"}`,
      `Messages: ${this.history.length}`,
      `Workspace: ${workspace}`
    ].join("\n");
  }

  toState(): AgentSessionState {
    return {
      id: this.id,
      history: this.history,
      instructionsLoaded: this.instructionsLoaded,
      goal: this.goal,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  getId(): string {
    return this.id;
  }

  getUpdatedAt(): number {
    return this.updatedAt;
  }

  getTitle(): string {
    const firstUserMessage = this.getVisibleHistory().find((entry) => entry.role === "user")?.content.trim();
    if (!firstUserMessage) {
      return "New thread";
    }
    const oneLine = firstUserMessage.replace(/\s+/g, " ");
    return oneLine.length > 72 ? `${oneLine.slice(0, 69)}...` : oneLine;
  }

  getVisibleHistory(limit = 40): AgentTranscriptEntry[] {
    return this.history
      .filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
      .filter((message) => !message.content.startsWith("<tool_result>") && !message.content.startsWith("<pinned_context"))
      .map((message) => ({
        role: message.role,
        content: message.role === "user" ? visibleUserPrompt(message.content) : message.content
      }))
      .filter((message) => Boolean(message.content.trim()))
      .slice(-limit);
  }

  private async appendToolResult(content: string): Promise<void> {
    this.history.push({
      role: "user",
      content: `<tool_result>\n${content}\n</tool_result>`
    });
  }

  private async ensureInstructions(): Promise<void> {
    if (this.instructionsLoaded) {
      return;
    }

    const instructions = await loadInstructions();
    if (instructions) {
      this.history.push({
        role: "system",
        content: `Follow these persistent Magnexis-style instructions from AGENTS.md files. Later instructions override earlier ones.\n\n${instructions}`
      });
    }
    this.instructionsLoaded = true;
  }

  private async tryHandleSlashCommand(prompt: string, sink: AgentUpdateSink): Promise<boolean> {
    const [command, ...rest] = prompt.trim().split(/\s+/);
    const argument = rest.join(" ");

    switch (command) {
      case "/status":
        await sink({ type: "assistant", content: this.status() });
        return true;
      case "/auto-context":
        await this.toggleAutoContext(argument, sink);
        return true;
      case "/new":
      case "/clear":
        this.reset();
        await sink({ type: "assistant", content: "Started a fresh thread." });
        return true;
      case "/goal":
        await this.handleGoal(argument, sink);
        return true;
      case "/local":
        await vscode.workspace.getConfiguration("magnexis").update("approvalMode", "agent", vscode.ConfigurationTarget.Workspace);
        await sink({ type: "assistant", content: "Switched to local Agent mode." });
        return true;
      case "/cloud":
      case "/cloud-environment":
        await sink({ type: "assistant", content: "Magnexis runs sessions locally and routes them to the provider you selected — there is no separate cloud environment to switch to.\n\nShowing current routing instead:\n\n" + this.status() });
        return true;
      case "/feedback":
        await vscode.env.openExternal(vscode.Uri.parse("https://github.com/magnexis/magnexis-agent-studio/issues"));
        await sink({ type: "assistant", content: "Opened the feedback/issues page." });
        return true;
      case "/model":
        if (argument) {
          await vscode.workspace.getConfiguration("magnexis").update("model", argument, vscode.ConfigurationTarget.Workspace);
        }
        await sink({ type: "assistant", content: `Model: ${getModel()}` });
        return true;
      case "/permissions":
        if (argument === "chat" || argument === "agent" || argument === "fullAccess") {
          await vscode.workspace.getConfiguration("magnexis").update("approvalMode", argument, vscode.ConfigurationTarget.Workspace);
        }
        await sink({ type: "assistant", content: `Mode: ${getApprovalMode()}` });
        return true;
      case "/reasoning":
        await this.handleReasoning(argument, sink);
        return true;
      case "/diff":
        await sink({ type: "assistant", content: await getGitDiff() });
        return true;
      default:
        if (prompt.trim().startsWith("/")) {
          await sink({ type: "assistant", content: `Unknown slash command: ${command}` });
          return true;
        }
        return false;
    }
  }

  private async toggleAutoContext(argument: string, sink: AgentUpdateSink): Promise<void> {
    const current = vscode.workspace.getConfiguration("magnexis").get<boolean>("autoContext", true);
    const next = argument === "on" ? true : argument === "off" ? false : !current;
    await vscode.workspace.getConfiguration("magnexis").update("autoContext", next, vscode.ConfigurationTarget.Workspace);
    await sink({ type: "assistant", content: `Auto Context: ${next ? "on" : "off"}` });
  }

  private async handleGoal(argument: string, sink: AgentUpdateSink): Promise<void> {
    if (!argument) {
      await sink({ type: "assistant", content: `Goal: ${this.goal ?? "none"}` });
      return;
    }
    if (argument === "clear") {
      this.goal = undefined;
      await sink({ type: "assistant", content: "Cleared the thread goal." });
      return;
    }
    this.goal = argument.slice(0, 4000);
    await sink({ type: "assistant", content: `Set goal: ${this.goal}` });
  }

  private async handleReasoning(argument: string, sink: AgentUpdateSink): Promise<void> {
    if (argument === "low" || argument === "medium" || argument === "high") {
      await vscode.workspace.getConfiguration("magnexis").update("reasoningEffort", argument, vscode.ConfigurationTarget.Workspace);
    }
    await sink({
      type: "assistant",
      content: `Reasoning: ${vscode.workspace.getConfiguration("magnexis").get<string>("reasoningEffort", "medium")}`
    });
  }

  private async buildReviewPrompt(prompt: string): Promise<string> {
    const scope = prompt.replace(/^\/review\s*/, "").trim();
    const diff = await getGitDiff();
    return [
      "Review the current workspace changes. Prioritize bugs, behavioral regressions, security issues, and missing tests.",
      scope ? `Focus: ${scope}` : "",
      "Return findings first, with file and line references when available. If there are no findings, say so clearly.",
      "<git_diff>",
      diff,
      "</git_diff>"
    ].filter(Boolean).join("\n");
  }
}

function limitToolOutput(output: string): string {
  const max = 2400;
  return output.length <= max ? output : `${output.slice(0, max)}\n\n[Output truncated]`;
}

function visibleUserPrompt(content: string): string {
  return content
    .replace(/^<goal>[\s\S]*?<\/goal>\s*/i, "")
    .replace(/^<reasoning_effort>[\s\S]*?<\/reasoning_effort>\s*/i, "")
    .split("\n\n<context>")[0]
    .trim();
}

function createThreadId(): string {
  return `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getGitDiff(): Promise<string> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return "Open a workspace before using /diff.";
  }

  return new Promise((resolve) => {
    cp.exec("git diff --stat && git diff --", {
      cwd: workspaceFolder.uri.fsPath,
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 2
    }, (error, stdout, stderr) => {
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      if (output) {
        resolve(limitDiff(output));
        return;
      }
      if (error) {
        resolve(`Unable to read git diff from ${path.basename(workspaceFolder.uri.fsPath)}: ${error.message}`);
        return;
      }
      resolve("No git diff.");
    });
  });
}

function limitDiff(diff: string): string {
  const max = 60000;
  if (diff.length <= max) {
    return diff;
  }
  return `${diff.slice(0, max)}\n\n[Diff truncated to fit context window.]`;
}

function parseAction(markdown: string): AgentAction | undefined {
  const match = markdown.match(actionPattern);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(match[1].trim()) as AgentAction;
    if (parsed.type === "tool" || parsed.type === "final") {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
