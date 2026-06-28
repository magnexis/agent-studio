import * as vscode from "vscode";
import { providerIds } from "./provider";

export interface SettingsSnapshot {
  provider: string;
  model: string;
  customBaseUrl: string;
  approvalMode: string;
  reasoningEffort: string;
  maxToolRounds: number;
  commandTimeoutMs: number;
  autoContext: boolean;
  persistThreads: boolean;
  commentCodeLensEnabled: boolean;
  maxWorkspaceFiles: number;
  maxFileBytes: number;
}

export function renderSettingsWebview(webview: vscode.Webview, extensionUri: vscode.Uri, snapshot: SettingsSnapshot): string {
  const nonce = getNonce();
  const styles = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "main.css"));
  const providerOptions = providerIds
    .map((value) => `<option value="${value}" ${snapshot.provider === value ? "selected" : ""}>${escapeHtml(capitalize(value))}</option>`)
    .join("");
  const approvalOptions = ["chat", "agent", "fullAccess"]
    .map((value) => `<option value="${value}" ${snapshot.approvalMode === value ? "selected" : ""}>${escapeHtml(capitalize(value))}</option>`)
    .join("");
  const reasoningOptions = ["low", "medium", "high"]
    .map((value) => `<option value="${value}" ${snapshot.reasoningEffort === value ? "selected" : ""}>${escapeHtml(capitalize(value))}</option>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link href="${styles}" rel="stylesheet">
  <title>Magnexis Settings</title>
</head>
<body class="settings-body">
  <main class="settings-shell">
    <header class="settings-head">
      <div>
        <h1>Magnexis Settings</h1>
        <p>Manage provider routing, approvals, and local workspace behavior.</p>
      </div>
      <div class="header-actions">
        <button type="button" id="manageKey">API Key</button>
        <button type="button" id="resetDefaults" class="ghost">Reset</button>
      </div>
    </header>

    <form id="settingsForm" class="settings-grid">
      <label>
        Provider
        <select id="provider">${providerOptions}</select>
      </label>
      <label>
        Default model
        <input id="model" type="text" value="${escapeAttr(snapshot.model)}" spellcheck="false">
      </label>
      <label>
        Custom base URL
        <input id="customBaseUrl" type="text" value="${escapeAttr(snapshot.customBaseUrl)}" spellcheck="false" placeholder="https://api.example.com/v1">
      </label>
      <label>
        Approval mode
        <select id="approvalMode">${approvalOptions}</select>
      </label>
      <label>
        Reasoning effort
        <select id="reasoningEffort">${reasoningOptions}</select>
      </label>
      <label>
        Max tool rounds
        <input id="maxToolRounds" type="number" min="1" max="30" value="${snapshot.maxToolRounds}">
      </label>
      <label>
        Command timeout ms
        <input id="commandTimeoutMs" type="number" min="5000" max="600000" step="1000" value="${snapshot.commandTimeoutMs}">
      </label>
      <label>
        Max workspace files
        <input id="maxWorkspaceFiles" type="number" min="10" max="300" value="${snapshot.maxWorkspaceFiles}">
      </label>
      <label>
        Max file bytes
        <input id="maxFileBytes" type="number" min="4000" max="120000" step="1000" value="${snapshot.maxFileBytes}">
      </label>
      <label class="toggle">
        <input id="autoContext" type="checkbox" ${snapshot.autoContext ? "checked" : ""}>
        <span>Auto context</span>
      </label>
      <label class="toggle">
        <input id="persistThreads" type="checkbox" ${snapshot.persistThreads ? "checked" : ""}>
        <span>Persist threads</span>
      </label>
      <label class="toggle">
        <input id="commentCodeLensEnabled" type="checkbox" ${snapshot.commentCodeLensEnabled ? "checked" : ""}>
        <span>TODO CodeLens</span>
      </label>
      <footer class="settings-actions">
        <button type="submit">Save settings</button>
        <button type="button" id="closeSettings" class="ghost">Close</button>
      </footer>
    </form>

    <section class="settings-note">
      <strong>Safety note</strong>
      <p>Magnexis never stores raw keys in visible settings after saving. Use manual approval for file edits and commands unless you explicitly choose a more permissive mode.</p>
    </section>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const form = document.getElementById("settingsForm");
    const provider = document.getElementById("provider");
    const model = document.getElementById("model");
    const customBaseUrl = document.getElementById("customBaseUrl");
    const approvalMode = document.getElementById("approvalMode");
    const reasoningEffort = document.getElementById("reasoningEffort");
    const maxToolRounds = document.getElementById("maxToolRounds");
    const commandTimeoutMs = document.getElementById("commandTimeoutMs");
    const autoContext = document.getElementById("autoContext");
    const persistThreads = document.getElementById("persistThreads");
    const commentCodeLensEnabled = document.getElementById("commentCodeLensEnabled");
    const maxWorkspaceFiles = document.getElementById("maxWorkspaceFiles");
    const maxFileBytes = document.getElementById("maxFileBytes");
    document.getElementById("manageKey").addEventListener("click", () => vscode.postMessage({ type: "setApiKey", provider: provider.value }));
    document.getElementById("closeSettings").addEventListener("click", () => vscode.postMessage({ type: "close" }));
    document.getElementById("resetDefaults").addEventListener("click", () => vscode.postMessage({ type: "resetDefaults" }));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      vscode.postMessage({
        type: "save",
        settings: {
          provider: provider.value,
          model: model.value.trim(),
          customBaseUrl: customBaseUrl.value.trim(),
          approvalMode: approvalMode.value,
          reasoningEffort: reasoningEffort.value,
          maxToolRounds: Number(maxToolRounds.value),
          commandTimeoutMs: Number(commandTimeoutMs.value),
          autoContext: autoContext.checked,
          persistThreads: persistThreads.checked,
          commentCodeLensEnabled: commentCodeLensEnabled.checked,
          maxWorkspaceFiles: Number(maxWorkspaceFiles.value),
          maxFileBytes: Number(maxFileBytes.value)
        }
      });
    });
  </script>
</body>
</html>`;
}

function capitalize(value: string): string {
  if (value === "openai") {
    return "OpenAI";
  }
  if (value === "zai") {
    return "Z.ai";
  }
  if (value === "kimi") {
    return "Kimi";
  }
  if (value === "groq") {
    return "Groq";
  }
  if (value === "openrouter") {
    return "OpenRouter";
  }
  if (value === "together") {
    return "Together AI";
  }
  if (value === "deepseek") {
    return "DeepSeek";
  }
  if (value === "xai") {
    return "xAI";
  }
  if (value === "lmstudio") {
    return "LM Studio";
  }
  if (value === "ollama") {
    return "Ollama";
  }
  if (value === "custom") {
    return "Custom";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
