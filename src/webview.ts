import * as vscode from "vscode";
import { providerPresets } from "@magnexis/llm-router";

export type WebviewSurface = "sidebar" | "panel";

export function renderWebview(webview: vscode.Webview, extensionUri: vscode.Uri, surface: WebviewSurface = "sidebar"): string {
  const nonce = getNonce();
  const styles = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "main.css"));
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "main.js"));
  const brandMark = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "magnexis-mark.svg"));
  const providerChoices = providerPresets.map((provider) => {
    const id = provider.id === "custom-openai-compatible" ? "custom" : provider.id;
    const icon = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "providers", `${provider.iconId ?? id}.png`));
    const verified = provider.models?.filter((model) => model.contextWindow).length ?? 0;
    return `<button type="button" data-provider="${id}" data-provider-kind="${provider.isLocal ? "local" : "cloud"}"><img src="${icon}" alt=""><span><strong>${provider.name}</strong><small>${provider.description ?? (provider.isLocal ? "Local endpoint" : "Cloud provider")}</small></span><em>${verified ? `${verified} verified` : `${provider.models?.length ?? 0} catalog models`}</em></button>`;
  }).join("");
  const catalog = JSON.stringify(Object.fromEntries(providerPresets.map((provider) => [provider.id === "custom-openai-compatible" ? "custom" : provider.id, provider]))).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link href="${styles}" rel="stylesheet">
  <title>Magnexis Agent Lab</title>
</head>
<body class="surface-${surface}" data-surface="${surface}">
  <main class="shell">
    <header class="topbar">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true"><img src="${brandMark}" alt=""></span>
        <div class="brand-copy">
          <h1>Agent Lab</h1>
          <p id="provider">Choose a provider to start</p>
        </div>
      </div>
      <div class="header-actions">
        <button id="newThreadAction" class="icon-action" type="button" title="New thread" aria-label="New thread"><span aria-hidden="true">+</span><em>New</em></button>
        <button id="toggleThreads" class="icon-action" type="button" title="Browse threads" aria-label="Browse threads" aria-expanded="false" aria-controls="threadRail"><span aria-hidden="true">&#9776;</span><em>Threads</em></button>
        <button id="moreActions" class="icon-action" type="button" title="More actions" aria-label="More actions" aria-expanded="false" aria-controls="headerMenu"><span aria-hidden="true">&#8943;</span><em>More</em></button>
        <div id="headerMenu" class="header-menu" hidden>
          <button id="openBesideAction" class="sidebar-only" type="button"><span aria-hidden="true">&#9707;</span><span><strong>Open beside editor</strong><small>Use a split editor group</small></span></button>
          <button id="popoutAction" type="button"><span aria-hidden="true">&#8599;</span><span><strong>Open in new window</strong><small>Move this chat into its own window</small></span></button>
          <button id="settingsPanel" type="button"><span aria-hidden="true">&#9881;</span><span><strong>Settings</strong><small>Providers, permissions, and context</small></span></button>
        </div>
      </div>
    </header>

    <section class="session-strip" aria-label="Current session">
      <button id="providerChip" class="session-chip provider-trigger" type="button" title="Choose provider and model">Choose provider</button>
      <span id="modeChip" class="session-chip accent-chip">Agent</span>
      <button id="toggleContext" class="session-chip context-toggle" type="button" aria-expanded="false" aria-controls="contextRail">Context</button>
    </section>

    <div class="workbench">
      <aside id="threadRail" class="thread-rail" aria-label="Thread history">
        <header class="thread-head">
          <div><strong>Threads</strong><p>Recent workspace conversations</p></div>
          <button id="closeThreads" class="close-context" type="button" aria-label="Close thread history">&#215;</button>
        </header>
        <div class="thread-toolbar">
          <input id="threadSearch" type="search" placeholder="Search threads" aria-label="Search threads">
          <button id="newThreadRailAction" type="button" title="Start a new thread" aria-label="Start a new thread">+</button>
        </div>
        <div id="threadList" class="thread-list" role="list"></div>
        <p id="threadEmpty" class="thread-empty" hidden>No matching threads.</p>
      </aside>
      <button id="threadBackdrop" class="thread-backdrop" type="button" aria-label="Close thread history" tabindex="-1"></button>
      <section class="conversation" aria-label="Conversation">
        <section id="messages" class="messages" aria-live="polite">
          <div id="emptyState" class="empty-state">
            <span class="empty-mark" aria-hidden="true">M</span>
            <h2>Work with your repository</h2>
            <p>Ask a question, plan a change, or let an agent inspect the project and propose reviewable edits.</p>
            <div class="starter-grid">
              <button type="button" data-prompt="Review the current changes and list concrete findings first."><strong>Review changes</strong><span>Find bugs and missing tests</span></button>
              <button type="button" data-prompt="Explain the current file and its role in this project."><strong>Explain this file</strong><span>Use active editor context</span></button>
              <button type="button" data-prompt="Generate focused tests for the current file."><strong>Generate tests</strong><span>Propose a reviewable patch</span></button>
              <button type="button" data-prompt="Find the most important security risks in this workspace."><strong>Security review</strong><span>Rank findings by severity</span></button>
            </div>
          </div>
        </section>

        <footer class="composer-dock">
          <div id="slashMenu" class="slash-menu" role="listbox" aria-label="Slash commands" hidden></div>
          <div class="quickbar" aria-label="Quick commands">
            <button type="button" data-prompt="/review">Review</button>
            <button type="button" data-prompt="/diff">Diff</button>
            <button type="button" data-prompt="/status">Status</button>
            <button type="button" data-prompt="/goal ">Goal</button>
          </div>
          <form id="composer" class="composer">
            <textarea id="prompt" rows="3" aria-label="Message coding assistant" placeholder="Ask about this repository..."></textarea>
            <div class="composer-actions">
              <div class="composer-control-row" aria-label="Composer controls">
                <div class="context-menu-wrap">
                  <button id="contextMenuToggle" class="composer-icon-button" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="contextMenu" title="Attach context" aria-label="Attach"><span class="composer-icon" aria-hidden="true">+</span></button>
                  <div id="contextMenu" class="context-menu" role="menu" hidden>
                    <button id="attachSelection" type="button" data-context-action="selection" role="menuitem" title="Attach selected code" aria-label="Selection" data-default-label="Selection"><span aria-hidden="true">{ }</span><strong>Attach selection</strong><small>Add the active editor selection</small></button>
                    <button id="attachFile" type="button" data-context-action="file" role="menuitem" title="Attach current file" aria-label="Current file" data-default-label="Current file"><span aria-hidden="true">&#9638;</span><strong>Attach current file</strong><small>Include the full active file</small></button>
                    <button id="attachWorkspace" type="button" data-context-action="workspace" role="menuitem" title="Add workspace map" aria-label="Workspace" data-default-label="Workspace"><span aria-hidden="true">@</span><strong>Add workspace map</strong><small>Insert workspace-level context</small></button>
                    <button type="button" data-context-action="panel" role="menuitem"><span aria-hidden="true">&#9776;</span><strong>Open context panel</strong><small>Browse workflows and config</small></button>
                  </div>
                </div>
                <button id="composerModelTrigger" class="composer-select-button" type="button" aria-haspopup="dialog" aria-expanded="false" title="Choose provider and model" aria-label="Choose model"><span class="composer-select-label">GLM-5.1</span><span class="composer-select-caret" aria-hidden="true">&#9662;</span></button>
              </div>
              <button id="send" class="send-button" type="submit" title="Send (Ctrl+Enter)" aria-label="Send"><span aria-hidden="true">&#8593;</span></button>
            </div>
          </form>
          <div class="composer-meta" aria-label="Composer status">
            <div class="composer-meta-row">
              <span class="composer-meta-label">Route</span>
              <code>provider:selected</code>
              <code>mode:agent</code>
              <code>approval:manual</code>
            </div>
            <div class="composer-meta-row">
              <span class="composer-meta-label">Context</span>
              <code>selection</code>
              <code>file</code>
              <code>workspace</code>
              <span class="composer-meta-hint">Ctrl+Enter to send</span>
            </div>
          </div>
          <section class="switchers" aria-label="Agent controls">
            <label>
              <span>Mode</span>
              <select id="modeSelect">
                <option value="chat">Chat</option>
                <option value="agent">Agent</option>
                <option value="fullAccess">Full Access</option>
              </select>
            </label>
            <label>
              <span>Reasoning</span>
              <select id="reasoningSelect">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label class="auto-context-field" title="Automatically attach recent editor context">
              <span>Auto context</span>
              <input id="autoContextInput" type="checkbox">
            </label>
          </section>
        </footer>
      </section>

      <aside id="contextRail" class="context-rail" aria-label="Workspace context">
        <header class="context-head">
          <div><strong>Workspace context</strong><p id="workspacePath">No workspace config loaded.</p></div>
          <button id="closeContext" class="close-context" type="button" aria-label="Close context panel">&#215;</button>
        </header>
        <section class="context-section">
          <div class="section-title"><strong>Quick goals</strong><span id="contextChip">Auto context</span></div>
          <div id="workspaceSummary" class="workspace-summary-list"></div>
        </section>
        <section class="context-section">
          <div class="section-title"><strong>Workflows</strong><span>Reusable</span></div>
          <div id="workflowTemplates" class="workflow-grid"></div>
        </section>
        <details class="context-section config-details">
          <summary>Workspace configuration</summary>
          <div id="workspaceConfig" class="workspace-list"></div>
        </details>
        <section class="provider-actions">
          <button id="statusAction" type="button">Session status</button>
          <button id="settings" type="button">Set API key</button>
        </section>
      </aside>
      <button id="contextBackdrop" class="context-backdrop" type="button" aria-label="Close context panel" tabindex="-1"></button>
    </div>
  </main>
  <div id="providerPicker" class="modal-backdrop" hidden>
    <section class="provider-dialog" role="dialog" aria-modal="true" aria-labelledby="providerPickerTitle">
      <header class="dialog-head">
        <div><h2 id="providerPickerTitle">Provider and model</h2><p>Requests go directly to the provider you select using your saved credentials.</p></div>
        <button id="closeProviderPicker" class="close-context" type="button" aria-label="Close provider picker">&#215;</button>
      </header>
      <div class="provider-filters">
        <input id="providerSearch" type="search" placeholder="Search providers" aria-label="Search providers">
        <div class="provider-filter-tabs" role="group" aria-label="Provider type"><button class="active" type="button" data-provider-filter="all">All</button><button type="button" data-provider-filter="cloud">Cloud</button><button type="button" data-provider-filter="local">Local</button></div>
      </div>
      <div class="provider-choice-grid" role="radiogroup" aria-label="Provider">
        ${providerChoices}
      </div>
      <p id="providerEmpty" class="provider-empty" hidden>No providers match this filter.</p>
      <input id="providerSelect" type="hidden" value="zai">
      <label class="dialog-field"><span class="dialog-field-head"><span>Available model</span><button id="refreshModels" type="button">Refresh models</button></span><select id="modelInput" aria-label="Available model"></select><small id="modelSource">Showing supported presets.</small></label>
      <div class="model-verification" id="modelVerification"><span>Context limit</span><strong id="modelContext">Reported by endpoint</strong><span id="modelDocs" hidden>Official docs verified</span></div>
      <label id="customModelField" class="dialog-field" hidden><span>Custom model identifier</span><input id="customModelInput" type="text" spellcheck="false" autocomplete="off" placeholder="provider-model-name"></label>
      <footer class="dialog-actions">
        <button id="providerApiKey" type="button">Manage API key</button>
        <span class="dialog-spacer"></span>
        <button id="cancelProviderPicker" type="button">Cancel</button>
        <button id="saveProviderPicker" class="primary-action" type="button">Use provider</button>
      </footer>
    </section>
  </div>
  <script nonce="${nonce}">window.magnexisProviderCatalog = ${catalog};</script>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
