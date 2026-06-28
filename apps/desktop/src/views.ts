export interface DesktopViewSpec {
  id: string;
  title: string;
  description: string;
}

export const desktopViews: DesktopViewSpec[] = [
  { id: "home", title: "Home", description: "Recent projects, health, and fast entry points." },
  { id: "projects", title: "Projects", description: "Pinned repos, favorites, and workspace health." },
  { id: "workspace", title: "Workspace", description: "Chat, diffs, terminal logs, and context layers." },
  { id: "chat", title: "Chat", description: "Repo-aware prompts and threaded responses." },
  { id: "diffs", title: "Diffs", description: "Reviewable edits and safe apply flows." },
  { id: "agents", title: "Agent Runs", description: "Task timelines, approvals, and summaries." },
  { id: "workflows", title: "Workflows", description: "Reusable prompts and agent task templates." },
  { id: "providers", title: "Providers", description: "Model routing, keys, and connection state." },
  { id: "tools", title: "Tools", description: "Agent tool catalog, risk levels, and approval gates." },
  { id: "cli", title: "CLI", description: "Terminal workflows, doctor checks, and one-shot local runs." },
  { id: "stats", title: "Model Stats", description: "External model rankings, benchmarks, speed, and pricing." },
  { id: "settings", title: "Settings", description: "Provider, auth, and safety controls." }
];
