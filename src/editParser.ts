export interface WorkspaceEditDocument {
  edits: Array<{
    path: string;
    content: string;
  }>;
}

const editBlockPattern = /```(?:workspace-edit|json)\s*([\s\S]*?)```/gi;

export function extractWorkspaceEdit(markdown: string): WorkspaceEditDocument | undefined {
  for (const match of markdown.matchAll(editBlockPattern)) {
    const body = match[1]?.trim();
    if (!body) {
      continue;
    }

    try {
      const parsed = JSON.parse(body) as WorkspaceEditDocument;
      if (Array.isArray(parsed.edits) && parsed.edits.every(isValidEdit)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function isValidEdit(value: unknown): value is WorkspaceEditDocument["edits"][number] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { path?: unknown; content?: unknown };
  return typeof candidate.path === "string" && typeof candidate.content === "string";
}
