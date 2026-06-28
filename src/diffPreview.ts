import * as vscode from "vscode";
import type { WorkspaceEditDocument } from "./editParser";

export class DiffPreviewService implements vscode.TextDocumentContentProvider {
  private readonly content = new Map<string, string>();
  private sequence = 0;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider("magnexis-before", this),
      vscode.workspace.registerTextDocumentContentProvider("magnexis-after", this)
    );
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.toString()) ?? "";
  }

  async preview(document: WorkspaceEditDocument, editIndex = 0): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("Open a workspace before previewing edits.");
    }

    const edit = document.edits[editIndex];
    if (!edit) {
      throw new Error("The selected edit no longer exists.");
    }

    const target = resolvePreviewPath(workspaceFolder, edit.path);
    let before = "";
    try {
      before = Buffer.from(await vscode.workspace.fs.readFile(target)).toString("utf8");
    } catch {
      before = "";
    }

    const token = `${Date.now().toString(36)}-${this.sequence += 1}`;
    const previewPath = `/${edit.path.replace(/\\/g, "/")}`;
    const beforeUri = vscode.Uri.from({ scheme: "magnexis-before", path: previewPath, query: token });
    const afterUri = vscode.Uri.from({ scheme: "magnexis-after", path: previewPath, query: token });
    this.content.set(beforeUri.toString(), before);
    this.content.set(afterUri.toString(), edit.content);

    await vscode.commands.executeCommand(
      "vscode.diff",
      beforeUri,
      afterUri,
      `Magnexis Preview: ${edit.path}`,
      { preview: true }
    );
  }
}

function resolvePreviewPath(workspaceFolder: vscode.WorkspaceFolder, relativePath: string): vscode.Uri {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Refusing to preview a path outside the workspace: ${relativePath}`);
  }
  return vscode.Uri.joinPath(workspaceFolder.uri, normalized);
}
