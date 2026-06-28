import * as cp from "child_process";
import * as path from "path";
import * as vscode from "vscode";
import { resolveDefaultApprovalMode } from "./projectConfig";
// Risk/description/catalog metadata lives in the shared packages package so it
// can be used by the desktop and web shells too. The runtime behaviour for the
// extension stays here because it depends on the VS Code API.
export { toolCatalog, getToolById, toolsRequiringApproval, describeToolRisk } from "../packages/tools/src";

export type ApprovalMode = "chat" | "agent" | "fullAccess";

export interface ToolRequest {
  tool: "list_files" | "read_file" | "search" | "run_command" | "apply_edit";
  args?: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  content: string;
}

const ignoredGlob = "**/{node_modules,.git,out,dist,build,coverage,.next,.turbo,vendor}/**";

export async function runTool(request: ToolRequest): Promise<ToolResult> {
  try {
    switch (request.tool) {
      case "list_files":
        return await listFiles(request.args);
      case "read_file":
        return await readFile(request.args);
      case "search":
        return await searchWorkspace(request.args);
      case "run_command":
        return await runCommand(request.args);
      case "apply_edit":
        return await applyEdit(request.args);
      default:
        return { ok: false, content: `Unknown tool: ${(request as ToolRequest).tool}` };
    }
  } catch (error) {
    return { ok: false, content: error instanceof Error ? error.message : String(error) };
  }
}

export function getApprovalMode(): ApprovalMode {
  return vscode.workspace.getConfiguration("magnexis").get<ApprovalMode>("approvalMode", resolveDefaultApprovalMode("agent"));
}

async function listFiles(args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const max = numberArg(args, "max", vscode.workspace.getConfiguration("magnexis").get<number>("maxWorkspaceFiles", 80));
  const pattern = stringArg(args, "pattern", "**/*");
  const files = await vscode.workspace.findFiles(pattern, ignoredGlob, max);
  return {
    ok: true,
    content: files.map((uri) => vscode.workspace.asRelativePath(uri, false)).sort().join("\n")
  };
}

async function readFile(args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const relativePath = requiredStringArg(args, "path");
  const uri = resolveWorkspacePath(relativePath);
  const bytes = await vscode.workspace.fs.readFile(uri);
  const maxBytes = vscode.workspace.getConfiguration("magnexis").get<number>("maxFileBytes", 24000);
  const content = new TextDecoder().decode(bytes);
  return {
    ok: true,
    content: limitBytes(content, maxBytes)
  };
}

async function searchWorkspace(args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const query = requiredStringArg(args, "query");
  const glob = stringArg(args, "glob", "**/*");
  const maxFiles = numberArg(args, "maxFiles", 80);
  const maxMatches = numberArg(args, "maxMatches", 80);
  const files = await vscode.workspace.findFiles(glob, ignoredGlob, maxFiles);
  const matches: string[] = [];
  const regex = new RegExp(escapeRegex(query), "i");

  for (const uri of files) {
    if (matches.length >= maxMatches) {
      break;
    }
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder().decode(bytes);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (regex.test(lines[index])) {
        matches.push(`${vscode.workspace.asRelativePath(uri, false)}:${index + 1}: ${lines[index].trim()}`);
        if (matches.length >= maxMatches) {
          break;
        }
      }
    }
  }

  return {
    ok: true,
    content: matches.length ? matches.join("\n") : "No matches."
  };
}

async function runCommand(args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const command = requiredStringArg(args, "command");
  const cwdArg = stringArg(args, "cwd", ".");
  const cwd = resolveWorkspacePath(cwdArg).fsPath;
  const mode = getApprovalMode();

  if (mode === "chat") {
    return { ok: false, content: "Command execution is disabled in Chat mode." };
  }

  if (mode !== "fullAccess") {
    const approved = await vscode.window.showWarningMessage(
      `Allow this command to run?\n\n${command}\n\nDirectory: ${cwd}`,
      { modal: true },
      "Run"
    );
    if (approved !== "Run") {
      return { ok: false, content: "Command not approved." };
    }
  }

  const timeout = vscode.workspace.getConfiguration("magnexis").get<number>("commandTimeoutMs", 120000);
  return new Promise((resolve) => {
    cp.exec(command, { cwd, timeout, windowsHide: true, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      const output = [
        stdout.trim(),
        stderr.trim(),
        error ? `exit/error: ${error.message}` : ""
      ].filter(Boolean).join("\n");
      resolve({
        ok: !error,
        content: output || "Command completed with no output."
      });
    });
  });
}

async function applyEdit(args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const relativePath = requiredStringArg(args, "path");
  const content = requiredStringArg(args, "content");
  const mode = getApprovalMode();

  if (mode === "chat") {
    return { ok: false, content: "File editing is disabled in Chat mode." };
  }

  if (mode !== "fullAccess") {
    const approved = await vscode.window.showWarningMessage(
      `Apply the proposed change to ${relativePath}?`,
      { modal: true },
      "Apply"
    );
    if (approved !== "Apply") {
      return { ok: false, content: "File edit not approved." };
    }
  }

  const uri = resolveWorkspacePath(relativePath);
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
  return { ok: true, content: `Wrote ${relativePath}.` };
}

function resolveWorkspacePath(relativePath: string): vscode.Uri {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("Open a workspace before using workspace tools.");
  }

  const normalized = relativePath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Refusing to access outside the workspace: ${relativePath}`);
  }

  return vscode.Uri.joinPath(workspaceFolder.uri, normalized);
}

function requiredStringArg(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required string argument: ${key}`);
  }
  return value;
}

function stringArg(args: Record<string, unknown> | undefined, key: string, fallback: string): string {
  const value = args?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberArg(args: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const value = args?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function limitBytes(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).byteLength <= maxBytes) {
    return text;
  }

  let end = Math.min(text.length, maxBytes);
  while (end > 0 && encoder.encode(text.slice(0, end)).byteLength > maxBytes) {
    end -= 100;
  }
    return `${text.slice(0, end)}\n\n[File truncated to fit context window.]`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
