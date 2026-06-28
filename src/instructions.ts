import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const instructionNames = ["AGENTS.override.md", "AGENTS.md"];
const maxInstructionBytes = 32768;

export async function loadInstructions(): Promise<string> {
  const chunks: Array<{ label: string; content: string }> = [];
  const globalLocations = [
    path.join(os.homedir(), ".magnexis"),
    path.join(os.homedir(), ".codex")
  ];
  for (const location of globalLocations) {
    const global = await readFirstExisting(location, instructionNames);
    if (global) {
      chunks.push(global);
      break;
    }
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (workspace) {
    const directories = getInstructionDirectories(workspace);
    for (const directory of directories) {
      const workspaceInstruction = await readFirstExisting(directory, instructionNames);
      if (workspaceInstruction) {
        chunks.push(workspaceInstruction);
      }
    }
  }

  if (!chunks.length) {
    return "";
  }

  const content = chunks.map((chunk) => `# ${chunk.label}\n\n${chunk.content}`).join("\n\n");
  return limitBytes(content, maxInstructionBytes);
}

function getInstructionDirectories(workspace: vscode.WorkspaceFolder): string[] {
  const root = workspace.uri.fsPath;
  const activeDocument = vscode.window.activeTextEditor?.document;
  if (!activeDocument || activeDocument.uri.scheme !== "file") {
    return [root];
  }

  const activeDirectory = path.dirname(activeDocument.uri.fsPath);
  const relative = path.relative(root, activeDirectory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return [root];
  }

  const parts = relative ? relative.split(path.sep).filter(Boolean) : [];
  const directories = [root];
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    directories.push(cursor);
  }
  return directories;
}

async function readFirstExisting(directory: string, names: string[]): Promise<{ label: string; content: string } | undefined> {
  for (const name of names) {
    const filePath = path.join(directory, name);
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = new TextDecoder().decode(bytes).trim();
      if (content) {
        return {
          label: filePath,
          content
        };
      }
    } catch {
      continue;
    }
  }
  return undefined;
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
  return `${text.slice(0, end)}\n\n[AGENTS.md truncated to fit context window.]`;
}
