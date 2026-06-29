import * as path from "path";
import * as vscode from "vscode";
import { AgentSession, AgentSessionState } from "./agentRunner";
import { WorkspaceEditDocument } from "./editParser";
import { DiffPreviewService } from "./diffPreview";
import { getModel, getProviderConfig, getProviderConfigById, isProviderId, normalizeBaseUrl, ProviderId } from "./provider";
import { getApprovalMode } from "./tools";
import { renderSettingsWebview, SettingsSnapshot } from "./settingsView";
import { renderWebview, type WebviewSurface } from "./webview";
import { createSidebarWorkspaceSnapshot, sidebarWorkflowTemplates, type SidebarWorkspaceSnapshot } from "./sidebarState";
import { probeProvider, type ProbeResult } from "../packages/llm-router/src";
import { registerAuthCommands, refreshAuthStatus } from "./extension/commands";
import { registerProtectedCommands } from "./extension/protectedCommands";
import { AuthStatusBarController } from "./extension/statusBar";
import { RuntimeStatusBarController } from "./extension/runtimeStatusBar";

let currentPanel: vscode.WebviewPanel | undefined;
let currentView: vscode.WebviewView | undefined;
let currentSettingsPanel: vscode.WebviewPanel | undefined;
let currentSession: AgentSession | undefined;
const sessionStateKey = "magnexis.currentSession";
const sessionsStateKey = "magnexis.sessions";
const activeSessionStateKey = "magnexis.activeSessionId";
const maxPersistedSessions = 30;
const diffPreviewService = new DiffPreviewService();

export function activate(context: vscode.ExtensionContext): void {
  diffPreviewService.register(context);
  const authStatusBar = new AuthStatusBarController();
  const runtimeStatusBar = new RuntimeStatusBarController();
  context.subscriptions.push(
    authStatusBar,
    runtimeStatusBar,
    vscode.commands.registerCommand("magnexis.openChat", () => openChat(context)),
    vscode.commands.registerCommand("magnexis.openChatBeside", () => openChat(context)),
    vscode.commands.registerCommand("magnexis.pinChatNearEditor", () => pinChatNearEditor(context)),
    vscode.commands.registerCommand("magnexis.openChatInNewWindow", () => openChatInNewWindow(context)),
    vscode.commands.registerCommand("magnexis.openSidebar", () => vscode.commands.executeCommand("magnexis.sidebar.focus")),
    vscode.commands.registerCommand("magnexis.newChat", () => newChat(context)),
    vscode.commands.registerCommand("magnexis.addSelectionToThread", () => addSelectionToThread(context)),
    vscode.commands.registerCommand("magnexis.addFileToThread", () => addFileToThread(context)),
    vscode.commands.registerCommand("magnexis.implementTodo", (range?: vscode.Range) => implementTodo(context, range)),
    vscode.commands.registerCommand("magnexis.reviewChanges", () => reviewChanges(context)),
    vscode.commands.registerCommand("magnexis.setApiKey", () => setApiKey(context)),
    vscode.commands.registerCommand("magnexis.clearApiKeys", () => clearApiKeys(context)),
    vscode.commands.registerCommand("magnexis.openSettings", () => openSettings(context)),
    vscode.commands.registerCommand("magnexis.testProvider", () => testProvider(context)),
    vscode.commands.registerCommand("magnexis.selectRuntime", () => runtimeStatusBar.openQuickPick())
  );

  context.subscriptions.push(
    ...registerAuthCommands({ context, statusBar: authStatusBar }),
    ...registerProtectedCommands({ context, statusBar: authStatusBar }),
    vscode.window.onDidChangeWindowState(() => {
      void refreshAuthStatus(context, authStatusBar);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("magnexis")) {
        runtimeStatusBar.refresh();
        broadcastProvider();
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ scheme: "file" }, new TodoCodeLensProvider()),
    vscode.window.registerWebviewViewProvider("magnexis.sidebar", new MagnexisViewProvider(context), {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  if (vscode.workspace.getConfiguration("magnexis").get<boolean>("openOnStartup", false)) {
    void vscode.commands.executeCommand("magnexis.sidebar.focus");
  }
  void refreshAuthStatus(context, authStatusBar);
  runtimeStatusBar.refresh();
}

export function deactivate(): void {
  // Nothing to clean up.
}

function openChat(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    return currentPanel;
  }

  currentSession = getSession(context);
  const panel = vscode.window.createWebviewPanel(
    "magnexis.chat",
    "Magnexis Agent Studio",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      enableFindWidget: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media")
      ]
    }
  );

  currentPanel = panel;
  configureWebview(context, panel.webview, "panel");
  postProviderToWebview(panel.webview);
  panel.onDidDispose(() => {
    currentPanel = undefined;
  });
  return panel;
}

async function openChatInNewWindow(context: vscode.ExtensionContext): Promise<void> {
  const panel = openChat(context);
  panel.reveal(vscode.ViewColumn.Beside);
  try {
    await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
  } catch {
    vscode.window.showWarningMessage("Magnexis could not move the chat automatically. Use the editor tab menu and choose Move into New Window.");
  }
}

function pinChatNearEditor(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = openChat(context);
  panel.title = "Magnexis Agent Studio";
  panel.reveal(vscode.ViewColumn.Beside, true);
  void vscode.window.showInformationMessage("Pinned Magnexis beside the active editor.");
  return panel;
}

function configureWebview(context: vscode.ExtensionContext, webview: vscode.Webview, surface: WebviewSurface): void {
  webview.options = {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, "media")
    ]
  };
  webview.html = renderWebview(webview, context.extensionUri, surface);
  currentSession = getSession(context);
  postWorkspaceToWebview(webview);
  postTranscriptToWebview(webview);
  postThreadsToWebview(webview, context);
  webview.onDidReceiveMessage(async (message: WebviewMessage) => {
    try {
      if (message.type === "setApiKey") {
        await setApiKey(context);
        broadcastProvider();
        return;
      }

      if (message.type === "setApiKeyForProvider") {
        await setApiKey(context, message.provider);
        broadcastProvider();
        return;
      }

      if (message.type === "openSettings") {
        openSettings(context);
        return;
      }

      if (message.type === "openBeside") {
        pinChatNearEditor(context);
        return;
      }

      if (message.type === "pinNearEditor") {
        pinChatNearEditor(context);
        return;
      }

      if (message.type === "popOut") {
        await openChatInNewWindow(context);
        return;
      }

      if (message.type === "newThread") {
        await resetCurrentThread(context);
        return;
      }

      if (message.type === "switchThread") {
        await switchThread(context, message.threadId);
        return;
      }

      if (message.type === "listModels") {
        const provider = getProviderConfigById(message.provider);
        const apiKey = await context.secrets.get(provider.secretKey);
        const result = await probeProvider({ baseUrl: provider.baseUrl, apiKey });
        webview.postMessage({
          type: "providerModels",
          provider: message.provider,
          ok: result.ok,
          detail: result.detail,
          models: result.models
        });
        return;
      }

      if (message.type === "attachSelection") {
        await addSelectionToThread(context, false);
        return;
      }

      if (message.type === "attachFile") {
        await addFileToThread(context, false);
        return;
      }

      if (message.type === "updateSettings") {
        await updateSettings(message);
        broadcastProvider();
        return;
      }

      if (message.type === "applyEdit") {
        await applyWorkspaceEdit(message.workspaceEdit);
        webview.postMessage({ type: "applied", count: message.workspaceEdit.edits.length });
        return;
      }

      if (message.type === "previewEdit") {
        await diffPreviewService.preview(message.workspaceEdit, message.editIndex);
        return;
      }

      if (message.type === "sendPrompt") {
        broadcast({ type: "user", content: message.prompt });
        const apiKey = await getApiKey(context);
        if (!apiKey) {
          await setApiKey(context);
        }

        const savedApiKey = await getApiKey(context);
        if (!savedApiKey) {
          throw new Error("No API key saved for the selected provider.");
        }

        await currentSession?.send(message.prompt, savedApiKey, async (update) => {
          broadcast(update);
        });
        await saveSession(context);
      }
    } catch (error) {
      webview.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

async function newChat(context: vscode.ExtensionContext): Promise<void> {
  openChat(context);
  await resetCurrentThread(context);
}

async function resetCurrentThread(context: vscode.ExtensionContext): Promise<void> {
  if (currentSession) {
    await saveSession(context);
  }
  currentSession = new AgentSession();
  await saveSession(context);
  broadcast({ type: "reset" });
  broadcast({ type: "assistant", content: "Started a fresh thread." });
}

async function switchThread(context: vscode.ExtensionContext, threadId: string): Promise<void> {
  if (currentSession?.getId() === threadId) {
    return;
  }
  if (currentSession) {
    await saveSession(context);
  }
  const saved = getStoredSessionStates(context).find((session) => session.id === threadId);
  if (!saved) {
    throw new Error("That Magnexis thread is no longer available.");
  }
  currentSession = new AgentSession(saved);
  await context.workspaceState.update(activeSessionStateKey, threadId);
  broadcast({ type: "transcript", entries: currentSession.getVisibleHistory() });
  broadcastThreads(context);
}

async function addSelectionToThread(context: vscode.ExtensionContext, revealPanel = true): Promise<void> {
  if (revealPanel) {
    openChat(context);
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showInformationMessage("Select code before adding it to the Magnexis thread.");
    return;
  }

  const pathLabel = vscode.workspace.asRelativePath(editor.document.uri, false);
  currentSession?.addContext(`selection:${pathLabel}`, editor.document.getText(editor.selection));
  await saveSession(context);
  broadcast({ type: "contextAdded", kind: "selection", label: pathLabel });
  broadcast({ type: "status", content: `Added selection from ${pathLabel} to the thread.` });
}

async function addFileToThread(context: vscode.ExtensionContext, revealPanel = true): Promise<void> {
  if (revealPanel) {
    openChat(context);
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("Open a file before adding it to the Magnexis thread.");
    return;
  }

  const pathLabel = vscode.workspace.asRelativePath(editor.document.uri, false);
  currentSession?.addContext(`file:${pathLabel}`, editor.document.getText());
  await saveSession(context);
  broadcast({ type: "contextAdded", kind: "file", label: pathLabel });
  broadcast({ type: "status", content: `Added ${pathLabel} to the thread.` });
}

async function implementTodo(context: vscode.ExtensionContext, range?: vscode.Range): Promise<void> {
  openChat(context);
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("Open a file with a TODO comment first.");
    return;
  }

  const selected = range
    ? editor.document.getText(range)
    : editor.selection.isEmpty
      ? editor.document.lineAt(editor.selection.active.line).text
      : editor.document.getText(editor.selection);
  const pathLabel = vscode.workspace.asRelativePath(editor.document.uri, false);
  const prompt = `Implement this TODO in @${pathLabel}:\n\n${selected}`;
  broadcast({ type: "user", content: prompt });

  const apiKey = await getApiKey(context);
  if (!apiKey) {
    await setApiKey(context);
  }
  const savedApiKey = await getApiKey(context);
  if (!savedApiKey) {
    return;
  }

  await currentSession?.send(prompt, savedApiKey, async (update) => {
    broadcast(update);
  });
  await saveSession(context);
}

async function reviewChanges(context: vscode.ExtensionContext): Promise<void> {
  openChat(context);
  const prompt = "/review";
  broadcast({ type: "user", content: prompt });

  const apiKey = await getApiKey(context);
  if (!apiKey) {
    await setApiKey(context);
  }
  const savedApiKey = await getApiKey(context);
  if (!savedApiKey) {
    return;
  }

  await currentSession?.send(prompt, savedApiKey, async (update) => {
    broadcast(update);
  });
  await saveSession(context);
}

async function setApiKey(context: vscode.ExtensionContext, providerId?: ProviderId): Promise<void> {
  const provider = providerId ? getProviderConfigById(providerId) : getProviderConfig();
  const value = await vscode.window.showInputBox({
    title: `Set ${provider.label} API Key`,
    prompt: "Stored securely in VS Code SecretStorage.",
    password: true,
    ignoreFocusOut: true
  });

  if (value === undefined) {
    return;
  }

  if (!value.trim()) {
    await context.secrets.delete(provider.secretKey);
    vscode.window.showInformationMessage(`Cleared ${provider.label} API key.`);
    return;
  }

  await context.secrets.store(provider.secretKey, value.trim());
  vscode.window.showInformationMessage(`Saved ${provider.label} API key.`);
}

async function clearApiKeys(context: vscode.ExtensionContext): Promise<void> {
  await Promise.all([
    context.secrets.delete("magnexis.apiKey.openai"),
    context.secrets.delete("magnexis.apiKey.anthropic"),
    context.secrets.delete("magnexis.apiKey.gemini"),
    context.secrets.delete("magnexis.apiKey.zai"),
    context.secrets.delete("magnexis.apiKey.mistral"),
    context.secrets.delete("magnexis.apiKey.kimi"),
    context.secrets.delete("magnexis.apiKey.groq"),
    context.secrets.delete("magnexis.apiKey.openrouter"),
    context.secrets.delete("magnexis.apiKey.together"),
    context.secrets.delete("magnexis.apiKey.deepseek"),
    context.secrets.delete("magnexis.apiKey.xai"),
    context.secrets.delete("magnexis.apiKey.perplexity"),
    context.secrets.delete("magnexis.apiKey.cerebras"),
    context.secrets.delete("magnexis.apiKey.fireworks"),
    context.secrets.delete("magnexis.apiKey.sambanova"),
    context.secrets.delete("magnexis.apiKey.nvidia"),
    context.secrets.delete("magnexis.apiKey.ollama"),
    context.secrets.delete("magnexis.apiKey.lmstudio"),
    context.secrets.delete("magnexis.apiKey.custom")
  ]);
  vscode.window.showInformationMessage("Cleared Magnexis API keys.");
}

function openSettings(context: vscode.ExtensionContext): void {
  if (currentSettingsPanel) {
    currentSettingsPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "magnexis.settings",
    "Magnexis Settings",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")]
    }
  );

  currentSettingsPanel = panel;
  configureSettingsWebview(context, panel.webview);
  panel.onDidDispose(() => {
    currentSettingsPanel = undefined;
  });
}

function configureSettingsWebview(context: vscode.ExtensionContext, webview: vscode.Webview): void {
  webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")]
  };
  webview.html = renderSettingsWebview(webview, context.extensionUri, getSettingsSnapshot());
  webview.onDidReceiveMessage(async (message: SettingsWebviewMessage) => {
    try {
      if (message.type === "setApiKey") {
        await setApiKey(context, isProviderId(message.provider) ? message.provider : undefined);
        return;
      }
      if (message.type === "resetDefaults") {
        await resetSettings();
        webview.html = renderSettingsWebview(webview, context.extensionUri, getSettingsSnapshot());
        return;
      }
      if (message.type === "save") {
        await updateSettingsFromSnapshot(message.settings);
        webview.html = renderSettingsWebview(webview, context.extensionUri, getSettingsSnapshot());
        broadcastProvider();
        return;
      }
      if (message.type === "close") {
        currentSettingsPanel?.dispose();
      }
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  });
}

function getSettingsSnapshot(): SettingsSnapshot {
  const config = vscode.workspace.getConfiguration("magnexis");
  return {
    provider: config.get<string>("provider", "zai"),
    model: config.get<string>("model", "glm-5.1"),
    customBaseUrl: config.get<string>("customBaseUrl", ""),
    approvalMode: config.get<string>("approvalMode", "agent"),
    reasoningEffort: config.get<string>("reasoningEffort", "medium"),
    maxToolRounds: config.get<number>("maxToolRounds", 12),
    commandTimeoutMs: config.get<number>("commandTimeoutMs", 120000),
    autoContext: config.get<boolean>("autoContext", true),
    persistThreads: config.get<boolean>("persistThreads", true),
    commentCodeLensEnabled: config.get<boolean>("commentCodeLensEnabled", true),
    maxWorkspaceFiles: config.get<number>("maxWorkspaceFiles", 80),
    maxFileBytes: config.get<number>("maxFileBytes", 24000)
  };
}

async function updateSettingsFromSnapshot(settings: SettingsSnapshot): Promise<void> {
  const config = vscode.workspace.getConfiguration("magnexis");
  await Promise.all([
    config.update("provider", settings.provider, vscode.ConfigurationTarget.Workspace),
    config.update("model", settings.model, vscode.ConfigurationTarget.Workspace),
    config.update("customBaseUrl", settings.customBaseUrl, vscode.ConfigurationTarget.Workspace),
    config.update("approvalMode", settings.approvalMode, vscode.ConfigurationTarget.Workspace),
    config.update("reasoningEffort", settings.reasoningEffort, vscode.ConfigurationTarget.Workspace),
    config.update("maxToolRounds", settings.maxToolRounds, vscode.ConfigurationTarget.Workspace),
    config.update("commandTimeoutMs", settings.commandTimeoutMs, vscode.ConfigurationTarget.Workspace),
    config.update("autoContext", settings.autoContext, vscode.ConfigurationTarget.Workspace),
    config.update("persistThreads", settings.persistThreads, vscode.ConfigurationTarget.Workspace),
    config.update("commentCodeLensEnabled", settings.commentCodeLensEnabled, vscode.ConfigurationTarget.Workspace),
    config.update("maxWorkspaceFiles", settings.maxWorkspaceFiles, vscode.ConfigurationTarget.Workspace),
    config.update("maxFileBytes", settings.maxFileBytes, vscode.ConfigurationTarget.Workspace)
  ]);
}

async function resetSettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration("magnexis");
  await Promise.all([
    config.update("provider", "zai", vscode.ConfigurationTarget.Workspace),
    config.update("model", "glm-5.1", vscode.ConfigurationTarget.Workspace),
    config.update("customBaseUrl", "", vscode.ConfigurationTarget.Workspace),
    config.update("approvalMode", "agent", vscode.ConfigurationTarget.Workspace),
    config.update("reasoningEffort", "medium", vscode.ConfigurationTarget.Workspace),
    config.update("maxToolRounds", 12, vscode.ConfigurationTarget.Workspace),
    config.update("commandTimeoutMs", 120000, vscode.ConfigurationTarget.Workspace),
    config.update("autoContext", true, vscode.ConfigurationTarget.Workspace),
    config.update("persistThreads", true, vscode.ConfigurationTarget.Workspace),
    config.update("commentCodeLensEnabled", true, vscode.ConfigurationTarget.Workspace),
    config.update("maxWorkspaceFiles", 80, vscode.ConfigurationTarget.Workspace),
    config.update("maxFileBytes", 24000, vscode.ConfigurationTarget.Workspace)
  ]);
}

function postProviderToWebview(webview: vscode.Webview): void {
  const provider = getProviderConfig();
  webview.postMessage({
    type: "provider",
    label: `Provider: ${provider.label} - ${provider.baseUrl || "no base URL set"}`,
    provider: provider.id,
    providerLabel: provider.label,
    model: getModel(),
    mode: getApprovalMode(),
    reasoning: vscode.workspace.getConfiguration("magnexis").get<string>("reasoningEffort", "medium"),
    autoContext: vscode.workspace.getConfiguration("magnexis").get<boolean>("autoContext", true)
  });
}

function postWorkspaceToWebview(webview: vscode.Webview): void {
  const snapshot = createSidebarWorkspaceSnapshot();
  webview.postMessage({
    type: "workspace",
    configPath: snapshot.configPath,
    configSummary: snapshot.configSummary,
    workflowTemplates: snapshot.workflowTemplates,
    quickGoalPrompts: snapshot.quickGoalPrompts
  });
}

function postTranscriptToWebview(webview: vscode.Webview): void {
  webview.postMessage({
    type: "transcript",
    entries: currentSession?.getVisibleHistory() ?? []
  });
}

function postThreadsToWebview(webview: vscode.Webview, context: vscode.ExtensionContext): void {
  const persist = vscode.workspace.getConfiguration("magnexis").get<boolean>("persistThreads", true);
  const sessions = persist ? getStoredSessionStates(context) : currentSession ? [currentSession.toState()] : [];
  webview.postMessage({
    type: "threads",
    activeThreadId: currentSession?.getId(),
    threads: sessions
      .map((state) => new AgentSession(state))
      .sort((left, right) => right.getUpdatedAt() - left.getUpdatedAt())
      .map((session) => ({
        id: session.getId(),
        title: session.getTitle(),
        updatedAt: session.getUpdatedAt(),
        messageCount: session.getVisibleHistory().length
      }))
  });
}

function broadcastThreads(context: vscode.ExtensionContext): void {
  if (currentPanel) {
    postThreadsToWebview(currentPanel.webview, context);
  }
  if (currentView) {
    postThreadsToWebview(currentView.webview, context);
  }
}

function broadcastProvider(): void {
  if (currentPanel) {
    postProviderToWebview(currentPanel.webview);
    postWorkspaceToWebview(currentPanel.webview);
  }
  if (currentView) {
    postProviderToWebview(currentView.webview);
    postWorkspaceToWebview(currentView.webview);
  }
}

function broadcast(message: unknown): void {
  currentPanel?.webview.postMessage(message);
  currentView?.webview.postMessage(message);
}

function getSession(context: vscode.ExtensionContext): AgentSession {
  if (currentSession) {
    return currentSession;
  }
  const persist = vscode.workspace.getConfiguration("magnexis").get<boolean>("persistThreads", true);
  const sessions = persist ? getStoredSessionStates(context) : [];
  const activeId = context.workspaceState.get<string>(activeSessionStateKey);
  const saved = sessions.find((session) => session.id === activeId) ?? sessions[0];
  currentSession = new AgentSession(saved);
  return currentSession;
}

async function saveSession(context: vscode.ExtensionContext): Promise<void> {
  const persist = vscode.workspace.getConfiguration("magnexis").get<boolean>("persistThreads", true);
  if (!persist || !currentSession) {
    return;
  }
  const state = currentSession.toState();
  const sessions = getStoredSessionStates(context)
    .filter((session) => session.id !== state.id)
    .concat(state)
    .sort((left, right) => (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt))
    .slice(0, maxPersistedSessions);
  await Promise.all([
    context.workspaceState.update(sessionStateKey, state),
    context.workspaceState.update(sessionsStateKey, sessions),
    context.workspaceState.update(activeSessionStateKey, state.id)
  ]);
  broadcastThreads(context);
}

function getStoredSessionStates(context: vscode.ExtensionContext): AgentSessionState[] {
  const sessions = context.workspaceState.get<AgentSessionState[]>(sessionsStateKey);
  if (Array.isArray(sessions) && sessions.length) {
    return sessions;
  }
  const legacy = context.workspaceState.get<AgentSessionState>(sessionStateKey);
  return legacy ? [legacy] : [];
}

async function updateSettings(message: Extract<WebviewMessage, { type: "updateSettings" }>): Promise<void> {
  if (isProviderId(message.provider)) {
    await vscode.workspace.getConfiguration("magnexis").update("provider", message.provider, vscode.ConfigurationTarget.Workspace);
  }
  if (message.model) {
    await vscode.workspace.getConfiguration("magnexis").update("model", message.model, vscode.ConfigurationTarget.Workspace);
  }
  if (message.mode === "chat" || message.mode === "agent" || message.mode === "fullAccess") {
    await vscode.workspace.getConfiguration("magnexis").update("approvalMode", message.mode, vscode.ConfigurationTarget.Workspace);
  }
  if (message.reasoning === "low" || message.reasoning === "medium" || message.reasoning === "high") {
    await vscode.workspace.getConfiguration("magnexis").update("reasoningEffort", message.reasoning, vscode.ConfigurationTarget.Workspace);
  }
  await vscode.workspace.getConfiguration("magnexis").update("autoContext", message.autoContext, vscode.ConfigurationTarget.Workspace);
}

async function applyWorkspaceEdit(document: WorkspaceEditDocument): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("Open a workspace before applying edits.");
  }

  const names = document.edits.map((edit) => edit.path).join(", ");
  const confirmation = await vscode.window.showWarningMessage(
    `Apply Magnexis edits to ${document.edits.length} file(s): ${names}?`,
    { modal: true },
    "Apply"
  );
  if (confirmation !== "Apply") {
    return;
  }

  for (const edit of document.edits) {
    const target = resolveWorkspacePath(workspaceFolder, edit.path);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(target.fsPath)));
    await vscode.workspace.fs.writeFile(target, Buffer.from(edit.content, "utf8"));
  }
}

function resolveWorkspacePath(workspaceFolder: vscode.WorkspaceFolder, relativePath: string): vscode.Uri {
  const normalized = relativePath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || normalized.includes("../")) {
    throw new Error(`Refusing to write outside the workspace: ${relativePath}`);
  }
  return vscode.Uri.joinPath(workspaceFolder.uri, normalized);
}

type WebviewMessage =
  | { type: "setApiKey" }
  | { type: "setApiKeyForProvider"; provider: ProviderId }
  | { type: "openSettings" }
  | { type: "pinNearEditor" }
  | { type: "openBeside" }
  | { type: "popOut" }
  | { type: "newThread" }
  | { type: "switchThread"; threadId: string }
  | { type: "listModels"; provider: ProviderId }
  | { type: "attachSelection" }
  | { type: "attachFile" }
  | { type: "updateSettings"; provider: ProviderId; model: string; mode: "chat" | "agent" | "fullAccess"; reasoning: "low" | "medium" | "high"; autoContext: boolean }
  | { type: "sendPrompt"; prompt: string }
  | { type: "applyEdit"; workspaceEdit: WorkspaceEditDocument }
  | { type: "previewEdit"; workspaceEdit: WorkspaceEditDocument; editIndex: number }
  | { type: "useTemplate"; prompt: string };

type SettingsWebviewMessage =
  | { type: "setApiKey"; provider?: string }
  | { type: "close" }
  | { type: "resetDefaults" }
  | { type: "save"; settings: SettingsSnapshot };

type WorkspaceWebviewMessage =
  | { type: "provider"; label: string; provider: string; providerLabel: string; model: string; mode: string; reasoning: string; autoContext: boolean }
  | { type: "workspace"; configPath?: string; configSummary: string[]; workflowTemplates: typeof sidebarWorkflowTemplates; quickGoalPrompts: string[] };

async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  return context.secrets.get(getProviderConfig().secretKey);
}

/**
 * Probe the active provider with a real GET /models request. Magnexis routes
 * to external endpoints under the user's key, so this verifies reachability
 * and that the key is accepted without sending a chat completion.
 */
async function testProvider(context: vscode.ExtensionContext): Promise<void> {
  const provider = getProviderConfig();
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  if (!baseUrl) {
    void vscode.window.showWarningMessage(`Cannot test ${provider.label}: set magnexis.customBaseUrl to the endpoint first.`);
    return;
  }

  const apiKey = await getApiKey(context);
  if (!apiKey) {
    const choice = await vscode.window.showWarningMessage(
      `No API key stored for ${provider.label}. Test anyway?`,
      { modal: true },
      "Test without key",
      "Set key first"
    );
    if (choice !== "Test without key") {
      await setApiKey(context);
      return;
    }
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Testing ${provider.label} connection`,
      cancellable: false
    },
    async () => {
      const result: ProbeResult = await probeProvider({
        baseUrl: provider.baseUrl,
        apiKey: apiKey ?? undefined
      });
      const heading = result.ok
        ? `${provider.label}: connected — ${result.detail}`
        : `${provider.label}: connection failed — ${result.detail}`;
      const modelList = result.models.length
        ? `\n\nModels available:\n${result.models.slice(0, 12).map((model) => `  - ${model}`).join("\n")}${result.models.length > 12 ? `\n  ...and ${result.models.length - 12} more` : ""}`
        : "";
      void vscode.window.showInformationMessage(heading + modelList);
    }
  );
}

class MagnexisViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    currentView = webviewView;
    currentSession = getSession(this.context);
    configureWebview(this.context, webviewView.webview, "sidebar");
    postProviderToWebview(webviewView.webview);
    webviewView.onDidDispose(() => {
      if (currentView === webviewView) {
        currentView = undefined;
      }
    });
  }
}

class TodoCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const enabled = vscode.workspace.getConfiguration("magnexis").get<boolean>("commentCodeLensEnabled", true);
    if (!enabled) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    for (let line = 0; line < document.lineCount; line += 1) {
      const text = document.lineAt(line).text;
      if (!/\b(TODO|FIXME)\b/i.test(text)) {
        continue;
      }
      lenses.push(new vscode.CodeLens(new vscode.Range(line, 0, line, text.length), {
        title: "Magnexis: Implement TODO",
        command: "magnexis.implementTodo",
        arguments: [new vscode.Range(line, 0, line, text.length)]
      }));
    }
    return lenses;
  }
}
