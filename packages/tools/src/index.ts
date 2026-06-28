import type { AgentTool, AgentContext } from "@magnexis/types";

/**
 * A serializable descriptor for an agent tool. Unlike {@link AgentTool}, it
 * carries only metadata so it can be rendered in the desktop and web shells
 * and inspected by the router without executing anything.
 */
export interface ToolDescriptor {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  args: ToolArgDescriptor[];
  example?: string;
  source?: "built-in" | "npm" | "mcp" | "system" | "custom";
  packageName?: string;
  installCommand?: string;
  installed?: boolean;
}

export type ToolCategory =
  | "filesystem"
  | "search"
  | "shell"
  | "edit"
  | "network"
  | "metadata";

export type ToolRiskLevel = "low" | "medium" | "high";

export interface ToolArgDescriptor {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

export const toolCatalog: ToolDescriptor[] = [
  {
    id: "list_files",
    name: "List files",
    description: "List workspace files matching a glob pattern, ignoring common build and dependency folders.",
    category: "filesystem",
    riskLevel: "low",
    requiresApproval: false,
    args: [
      { name: "pattern", type: "string", required: false, description: "Glob pattern to match.", default: "**/*" },
      { name: "max", type: "number", required: false, description: "Maximum number of paths to return.", default: 80 }
    ],
    example: "list_files({ pattern: \"src/**/*.ts\" })"
  },
  {
    id: "read_file",
    name: "Read file",
    description: "Read the contents of a workspace-relative file, truncated to fit the model context window.",
    category: "filesystem",
    riskLevel: "low",
    requiresApproval: false,
    args: [
      { name: "path", type: "string", required: true, description: "Workspace-relative file path." }
    ],
    example: "read_file({ path: \"src/extension.ts\" })"
  },
  {
    id: "search",
    name: "Search workspace",
    description: "Search file contents for a query string or regex and return matching lines with line numbers.",
    category: "search",
    riskLevel: "low",
    requiresApproval: false,
    args: [
      { name: "query", type: "string", required: true, description: "String or regex to search for." },
      { name: "glob", type: "string", required: false, description: "Glob filter for files to search.", default: "**/*" },
      { name: "maxMatches", type: "number", required: false, description: "Maximum matches to return.", default: 80 }
    ],
    example: "search({ query: \"createDesktopShellState\" })"
  },
  {
    id: "run_command",
    name: "Run shell command",
    description: "Execute a shell command in the workspace directory. Requires approval unless running in Full Access mode.",
    category: "shell",
    riskLevel: "high",
    requiresApproval: true,
    args: [
      { name: "command", type: "string", required: true, description: "Shell command to execute." },
      { name: "cwd", type: "string", required: false, description: "Working directory relative to the workspace.", default: "." }
    ],
    example: "run_command({ command: \"npm test\" })"
  },
  {
    id: "apply_edit",
    name: "Apply edit",
    description: "Write the full contents of a workspace-relative file. Requires approval unless running in Full Access mode.",
    category: "edit",
    riskLevel: "medium",
    requiresApproval: true,
    args: [
      { name: "path", type: "string", required: true, description: "Workspace-relative file path to write." },
      { name: "content", type: "string", required: true, description: "Complete new file contents." }
    ],
    example: "apply_edit({ path: \"src/example.ts\", content: \"export const value = 1;\\n\" })"
  }
];

export const installableToolCatalog: ToolDescriptor[] = [
  {
    id: "browser_session", name: "Browser session", description: "Open controlled browser sessions, inspect visible UI state, and capture screenshot evidence.",
    category: "network", riskLevel: "high", requiresApproval: true, source: "npm", packageName: "agent-portal-2", installCommand: "npm install agent-portal-2", installed: false,
    args: [{ name: "url", type: "string", required: true, description: "URL to open in a controlled session." }]
  },
  {
    id: "github_cli", name: "GitHub CLI", description: "Inspect pull requests, issues, checks, and authenticated repository metadata through the local gh CLI.",
    category: "network", riskLevel: "medium", requiresApproval: true, source: "system", packageName: "gh", installCommand: "winget install --id GitHub.cli", installed: false,
    args: [{ name: "command", type: "string", required: true, description: "Allowlisted gh command and arguments." }]
  },
  {
    id: "mcp_server", name: "MCP server", description: "Register a local or remote Model Context Protocol server and expose its declared tools to an agent run.",
    category: "metadata", riskLevel: "medium", requiresApproval: true, source: "mcp", installed: false,
    args: [{ name: "manifest", type: "string", required: true, description: "Validated MCP server manifest JSON." }]
  },
  {
    id: "test_runner", name: "Test runner adapter", description: "Detect package test scripts and propose focused test commands without executing them automatically.",
    category: "shell", riskLevel: "medium", requiresApproval: true, source: "built-in", installed: false,
    args: [{ name: "scope", type: "string", required: false, description: "File, package, or test pattern to target." }]
  }
];

export function listToolIds(): string[] {
  return toolCatalog.map((tool) => tool.id);
}

export function getToolById(id: string): ToolDescriptor | undefined {
  return toolCatalog.find((tool) => tool.id === id);
}

export function toolsByCategory(category: ToolCategory): ToolDescriptor[] {
  return toolCatalog.filter((tool) => tool.category === category);
}

export function toolsRequiringApproval(): ToolDescriptor[] {
  return toolCatalog.filter((tool) => tool.requiresApproval);
}

export function summarizeToolCatalog(tools: ToolDescriptor[] = toolCatalog): string[] {
  return tools.map((tool) => `${tool.id} (${tool.riskLevel}): ${tool.description}`);
}

export function describeToolRisk(level: ToolRiskLevel): string {
  switch (level) {
    case "low":
      return "Read-only. Safe to run without prompting.";
    case "medium":
      return "Changes workspace state. Confirm before applying.";
    case "high":
      return "Executes commands or touches sensitive paths. Always confirm.";
    default:
      return "Unknown risk.";
  }
}

/**
 * Adapts a {@link ToolDescriptor} into the runtime {@link AgentTool} shape used
 * by the agent core. The supplied `run` implementation is bound to the tool so
 * catalog metadata and executable behavior stay in sync.
 */
export function toAgentTool<I, O>(
  descriptor: ToolDescriptor,
  run: (input: I, context: AgentContext) => Promise<O>
): AgentTool<I, O> {
  return {
    id: descriptor.id,
    name: descriptor.name,
    description: descriptor.description,
    requiresApproval: descriptor.requiresApproval,
    riskLevel: descriptor.riskLevel,
    run
  };
}
