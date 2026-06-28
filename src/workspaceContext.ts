import * as path from "path";
import * as vscode from "vscode";

const ignoredGlob = "**/{node_modules,.git,out,dist,build,coverage,.next,.turbo,vendor}/**";

export interface PromptContext {
  activeFile?: string;
  selection?: string;
  activeFileText?: string;
  mentionedFiles?: Array<{ path: string; content: string }>;
  workspaceMap?: string;
}

export async function collectPromptContext(prompt: string): Promise<PromptContext> {
  const result: PromptContext = {};
  const editor = vscode.window.activeTextEditor;
  const autoContext = vscode.workspace.getConfiguration("magnexis").get<boolean>("autoContext", true);

  if (editor && autoContext) {
    result.activeFile = vscode.workspace.asRelativePath(editor.document.uri, false);
    const selection = editor.selection;
    if (!selection.isEmpty) {
      result.selection = editor.document.getText(selection);
    } else if (editor.document.uri.scheme === "file") {
      result.activeFileText = await limitedDocumentText(editor.document);
    }
  }

  if (prompt.includes("@workspace")) {
    result.workspaceMap = await buildWorkspaceMap();
  }

  result.mentionedFiles = await collectMentionedFiles(prompt);

  return result;
}

async function limitedDocumentText(document: vscode.TextDocument): Promise<string> {
  const maxBytes = vscode.workspace.getConfiguration("magnexis").get<number>("maxFileBytes", 24000);
  const text = document.getText();
  return limitBytes(text, maxBytes);
}

async function buildWorkspaceMap(): Promise<string> {
  const config = vscode.workspace.getConfiguration("magnexis");
  const maxFiles = config.get<number>("maxWorkspaceFiles", 80);
  const files = await vscode.workspace.findFiles("**/*", ignoredGlob, maxFiles);
  const roots = vscode.workspace.workspaceFolders ?? [];

  return files
    .map((uri) => {
      const relative = vscode.workspace.asRelativePath(uri, false);
      const root = roots.find((folder) => uri.fsPath.startsWith(folder.uri.fsPath));
      if (!root) {
        return relative;
      }
      return path.relative(root.uri.fsPath, uri.fsPath).replace(/\\/g, "/");
    })
    .sort((a, b) => a.localeCompare(b))
    .join("\n");
}

export function formatContext(context: PromptContext): string {
  const parts: string[] = [];

  if (context.activeFile) {
    parts.push(`<active_file path="${context.activeFile}">`);
    if (context.selection) {
      parts.push("<selection>");
      parts.push(context.selection);
      parts.push("</selection>");
    } else if (context.activeFileText) {
      parts.push(context.activeFileText);
    }
    parts.push("</active_file>");
  }

  if (context.workspaceMap) {
    parts.push("<workspace_files>");
    parts.push(context.workspaceMap);
    parts.push("</workspace_files>");
  }

  if (context.mentionedFiles?.length) {
    parts.push("<mentioned_files>");
    for (const file of context.mentionedFiles) {
      parts.push(`<file path="${file.path}">`);
      parts.push(file.content);
      parts.push("</file>");
    }
    parts.push("</mentioned_files>");
  }

  return parts.join("\n");
}

async function collectMentionedFiles(prompt: string): Promise<Array<{ path: string; content: string }>> {
  const maxBytes = vscode.workspace.getConfiguration("magnexis").get<number>("maxFileBytes", 24000);
  const mentions = Array.from(prompt.matchAll(/@([A-Za-z0-9._/\-\\]+\.[A-Za-z0-9]+)/g))
    .map((match) => match[1])
    .filter((value, index, array) => array.indexOf(value) === index);
  const files: Array<{ path: string; content: string }> = [];

  for (const mention of mentions) {
    const normalized = mention.replace(/\\/g, "/");
    const matches = await vscode.workspace.findFiles(`**/${normalized}`, ignoredGlob, 1);
    const uri = matches[0];
    if (!uri) {
      continue;
    }
    const bytes = await vscode.workspace.fs.readFile(uri);
    files.push({
      path: vscode.workspace.asRelativePath(uri, false),
      content: limitBytes(new TextDecoder().decode(bytes), maxBytes)
    });
  }

  return files;
}

function limitBytes(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).byteLength <= maxBytes) {
    return text;
  }

  let end = Math.min(text.length, maxBytes);
  while (encoder.encode(text.slice(0, end)).byteLength > maxBytes) {
    end -= 100;
  }
  return `${text.slice(0, end)}\n\n[File truncated to fit context window.]`;
}
