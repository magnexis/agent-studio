const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const sourcePath = path.join(root, "src/webview.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  },
  fileName: sourcePath
}).outputText;

const vscode = {
  Uri: {
    joinPath(_base, ...parts) {
      return { path: `/${parts.join("/")}` };
    }
  }
};
const moduleRecord = { exports: {} };
const evaluate = new Function("require", "module", "exports", output);
const routerPath = path.join(root, "packages/llm-router/src/index.ts");
const routerOutput = ts.transpileModule(fs.readFileSync(routerPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: routerPath
}).outputText;
const routerRecord = { exports: {} };
new Function("require", "module", "exports", routerOutput)(require, routerRecord, routerRecord.exports);
evaluate((specifier) => specifier === "vscode" ? vscode : specifier === "@magnexis/llm-router" ? routerRecord.exports : require(specifier), moduleRecord, moduleRecord.exports);

const initialMessages = [
  {
    type: "provider",
    provider: "zai",
    providerLabel: "Z.ai",
    model: "glm-5.1",
    mode: "agent",
    reasoning: "medium",
    autoContext: true,
    label: "Provider: Z.ai"
  },
  {
    type: "workspace",
    configPath: ".magnexis/config.json",
    configSummary: ["Approval mode: manual", "Auto apply: off", "Indexing: on", "Context: 50 files / 250 KB"],
    quickGoalPrompts: ["Review this diff", "Generate tests", "Refactor selected code", "Find security issues"],
    workflowTemplates: [
      { name: "Review This PR", description: "Find regressions and missing tests.", modelPreference: "zai/glm-5.1", safetyMode: "manual", promptTemplate: "Review the current diff and list concrete findings first." },
      { name: "Generate Tests", description: "Create focused tests for changed behavior.", modelPreference: "ollama/qwen2.5-coder", safetyMode: "manual", promptTemplate: "Write focused tests for the current file." }
    ]
  },
  {
    type: "transcript",
    entries: [
      { role: "user", content: "Review the provider routing changes and identify any unsafe fallback behavior." },
      { role: "assistant", content: "I inspected the provider registry and routing defaults. The main risk is that a missing cloud credential currently falls through to a custom endpoint without clearly surfacing the route change. I would make that fallback explicit and keep it behind approval." }
    ]
  },
  {
    type: "threads",
    activeThreadId: "provider-routing",
    threads: [
      { id: "provider-routing", title: "Provider routing fallback review", updatedAt: Date.now() - 90_000, messageCount: 9 },
      { id: "auth-callback", title: "Authentication callback repair", updatedAt: Date.now() - 3_600_000, messageCount: 14 },
      { id: "indexer-cache", title: "Indexer cache boundary", updatedAt: Date.now() - 86_400_000, messageCount: 7 },
      { id: "release", title: "Desktop and extension release checklist", updatedAt: Date.now() - 604_800_000, messageCount: 11 }
    ]
  },
  {
    type: "tool",
    content: "Read src/provider.ts",
    toolCall: {
      id: "preview-read-1",
      tool: "read_file",
      args: { path: "src/provider.ts" },
      status: "completed",
      output: "Loaded provider registry and endpoint presets.",
      requiresApproval: false
    }
  },
  {
    type: "assistant",
    content: "I prepared a small guarded fallback patch. Review the native diff before applying it.",
    workspaceEdit: {
      edits: [
        { path: "src/provider.ts", content: "export function resolveProvider() {\n  return requireExplicitFallback();\n}\n" },
        { path: "src/llmClient.ts", content: "export async function complete() {\n  // provider routing remains explicit\n}\n" }
      ]
    }
  }
];

const previewDirectory = path.join(root, "workspaces/runtime/previews");
fs.mkdirSync(previewDirectory, { recursive: true });

for (const surface of ["sidebar", "panel"]) {
  const fakeWebview = {
    cspSource: "'self'",
    asWebviewUri(uri) {
      return uri.path;
    }
  };
  let html = moduleRecord.exports.renderWebview(fakeWebview, { path: "/" }, surface);
  const nonce = html.match(/script-src 'nonce-([^']+)'/)?.[1];
  const scriptTag = `<script nonce="${nonce}" src="/media/main.js"></script>`;
  const shim = `<script nonce="${nonce}">
    window.__magnexisMessages = [];
    window.acquireVsCodeApi = () => ({
      postMessage(message) { window.__magnexisMessages.push(message); },
      getState() { return window.__magnexisState || {}; },
      setState(state) { window.__magnexisState = state; }
    });
  </script>`;
  const hydrate = `<script nonce="${nonce}">
    ${JSON.stringify(initialMessages)}.forEach((data) => window.dispatchEvent(new MessageEvent("message", { data })));
  </script>`;
  html = html.replace(scriptTag, `${shim}${scriptTag}${hydrate}`);
  fs.writeFileSync(path.join(previewDirectory, `magnexis-vscode-${surface}.html`), html, "utf8");
}

console.log(previewDirectory);
