import { defaultMagnexisConfig, describeMagnexisConfigSources, loadMagnexisConfigFromWorkspace, type MagnexisConfig } from "@magnexis/config";
import { defaultIndexerConfig, resolveIndexerConfig, summarizeIndexedPaths } from "@magnexis/indexer";
import { buildDefaultRoutingProfile, defaultLimitsForModel, providerPresets } from "@magnexis/llm-router";
import { summarizeWorkflowTemplates } from "@magnexis/agent-core";
import { installableToolCatalog, toolCatalog, type ToolDescriptor } from "@magnexis/tools";
import type { LLMModelConfig } from "@magnexis/types";
import { magnexisInteractiveComponentsCss, magnexisInteractiveTokensCss } from "../../../packages/ui/src/index";
import { summarizeToolCapabilities } from "./runtime";
import { desktopViews, type DesktopViewSpec } from "./views";
export type { DesktopProviderInput, DesktopProviderModelsResult, DesktopProviderTestResult, DesktopRuntimeBridge, DesktopSettingsInput } from "./runtimeBridge";

export interface DesktopShellState {
  config: MagnexisConfig;
  indexer: ReturnType<typeof resolveIndexerConfig>;
  views: DesktopViewSpec[];
  quickActions: string[];
  workspaceNotes: string[];
  routingProfile: ReturnType<typeof buildDefaultRoutingProfile>;
  providers: LLMProviderCard[];
  safetySummary: string[];
  workflowSummary: string[];
  configSources: string[];
  toolSummary: ReturnType<typeof summarizeToolCapabilities>;
  tools: ToolDescriptor[];
}

export interface LLMProviderCard {
  id: string;
  name: string;
  monogram: string;
  iconId: string;
  baseUrl: string;
  description: string;
  type: "Cloud" | "Local";
  status: "Connected" | "Needs key" | "Available";
  models: LLMModelConfig[];
  accent: "green" | "blue" | "amber";
}

export function createDesktopShellState(workspaceRoot?: string): DesktopShellState {
  const config = workspaceRoot ? loadMagnexisConfigFromWorkspace(workspaceRoot) : defaultMagnexisConfig;
  const indexer = workspaceRoot ? resolveIndexerConfig(workspaceRoot) : defaultIndexerConfig;

  return {
    config,
    indexer,
    views: desktopViews,
    quickActions: ["New task", "Add provider", "Review approvals", "Open project"],
    workspaceNotes: workspaceRoot
      ? summarizeIndexedPaths([".magnexis/config.json", "AGENTS.md"], indexer.ignore).map((item) => `${item.path}: ${item.ignored ? "ignored" : "indexed"}`)
      : ["Local workspace ready", "Secrets remain on this device"],
    routingProfile: buildDefaultRoutingProfile(),
    providers: buildProviderCards(),
    safetySummary: [
      `Approval mode: ${config.approvalMode}`,
      `Auto apply: ${config.autoApply ? "enabled" : "off"}`,
      `Auto commands: ${config.autoRunCommands ? "enabled" : "off"}`,
      `Indexed files cap: ${indexer.maxFiles}`
    ],
    workflowSummary: summarizeWorkflowTemplates(),
    configSources: workspaceRoot ? describeMagnexisConfigSources(workspaceRoot) : describeMagnexisConfigSources(),
    toolSummary: summarizeToolCapabilities(),
    tools: [...toolCatalog.map((tool) => ({ ...tool, source: "built-in" as const, installed: true })), ...installableToolCatalog]
  };
}

export function renderDesktopHome(state: DesktopShellState): string {
  const providerCards = state.providers.map((provider, index) => `
    <article class="provider-card ${index === 1 ? "selected" : ""}" data-provider="${escapeHtml(provider.id)}" data-provider-type="${provider.type.toLowerCase()}" data-provider-status="${provider.status.toLowerCase().replace(/\s+/g, "-")}">
      <div class="provider-heading">
        <div class="provider-mark ${provider.accent}"><img src="../../../media/providers/${escapeHtml(provider.iconId)}.png" alt="" onerror="this.replaceWith(document.createTextNode('${escapeHtml(provider.monogram)}'))"></div>
        <div class="provider-name">
          <strong>${escapeHtml(provider.name)}</strong>
          <span>${escapeHtml(provider.description)}</span>
        </div>
        <span class="provider-status ${provider.status.toLowerCase().replace(/\s+/g, "-")}"><span class="status-dot ${provider.accent}"></span>${escapeHtml(provider.status)}</span>
      </div>
      <div class="provider-meta">
        <span>${escapeHtml(provider.type)}</span>
        <span class="meta-separator"></span>
        <span>${provider.models.length} catalog model${provider.models.length === 1 ? "" : "s"}</span>
      </div>
      <div class="model-list">
        ${provider.models.length ? provider.models.slice(0, 2).map((model) => `<a class="model-chip" href="${escapeHtml(model.contextSourceUrl ?? "#")}" target="_blank" rel="noreferrer" title="Verified ${escapeHtml(model.contextVerifiedAt ?? "")}"><img src="../../../media/providers/${escapeHtml(provider.iconId)}.png" alt=""><span>${escapeHtml(model.displayName)}</span><b>${formatTokens(model.contextWindow)} ctx</b></a>`).join("") : `<span class="dynamic-model-note">Model limits reported by endpoint</span>`}
      </div>
      <div class="provider-actions">
        <button class="button secondary provider-configure" type="button">Configure</button>
        <button class="button quiet provider-test" type="button">Test connection</button>
      </div>
    </article>`).join("");

  const toolCards = state.tools.map((tool) => {
    return `
    <article class="tool-card" data-tool="${escapeHtml(tool.id)}" data-category="${escapeHtml(tool.category)}" data-installed="${tool.installed ? "true" : "false"}">
      <div class="tool-heading">
        <div class="tool-mark ${tool.riskLevel}">${escapeHtml(tool.category.charAt(0).toUpperCase())}</div>
        <div class="tool-name">
          <strong>${escapeHtml(tool.name)}</strong>
          <span>${escapeHtml(tool.id)}</span>
        </div>
        <span class="task-state risk ${tool.riskLevel}">${escapeHtml(tool.riskLevel)} risk</span>
      </div>
      <p class="tool-description">${escapeHtml(tool.description)}</p>
      <div class="tool-args">
        <span class="inspector-label">Arguments</span>
        <div class="arg-list">
          ${tool.args.map((arg) => `<div class="arg-row"><code>${escapeHtml(arg.name)}</code><span>${arg.required ? "required" : "optional"} &middot; ${escapeHtml(arg.type)}</span></div>`).join("")}
        </div>
      </div>
      <div class="tool-footer">
        <span class="tool-approval ${tool.requiresApproval ? "gated" : "safe"}">${tool.requiresApproval ? "Approval required before running" : "Runs without prompting"}</span>
        ${tool.example ? `<code class="tool-example">${escapeHtml(tool.example)}</code>` : ""}
        <div class="tool-registry-actions"><span>${escapeHtml(tool.source ?? "built-in")}${tool.packageName ? ` &middot; ${escapeHtml(tool.packageName)}` : ""}</span><button class="button ${tool.installed ? "quiet tool-toggle" : "primary tool-install"}" type="button">${tool.installed ? "Enabled" : "Register"}</button></div>
      </div>
    </article>`;
  }).join("");

  const navigation = [
    { id: "chat", icon: "&#9671;", label: "Chat" },
    { id: "diffs", icon: "D", label: "Diffs" },
    { id: "providers", icon: "P", label: "Providers" },
    { id: "agents", icon: "A", label: "Agent tasks" },
    { id: "tools", icon: "&#9874;", label: "Tools" },
    { id: "stats", icon: "&#8599;", label: "Model stats" },
    { id: "settings", icon: "&#9881;", label: "Settings" }
  ].map((item) => `
    <button class="rail-button ${item.id === "chat" ? "active" : ""}" type="button" data-view="${item.id}" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}">
      <span class="rail-icon" aria-hidden="true">${item.icon}</span>
      <span class="rail-label">${escapeHtml(item.label)}</span>
    </button>`).join("");
  const sidebarThreads = [
    { title: "Generate README", meta: "Active now", delta: "+83 -17" },
    { title: "Review main branch diff", meta: "5h", delta: "" },
    { title: "Migrate auth callback", meta: "6h", delta: "" },
    { title: "Update provider branding", meta: "6h", delta: "" }
  ].map((thread, index) => `
    <button class="sidebar-thread ${index === 0 ? "active" : ""}" type="button" data-view="chat">
      <span class="sidebar-thread-dot" aria-hidden="true"></span>
      <span class="sidebar-thread-copy"><strong>${escapeHtml(thread.title)}</strong><small>${escapeHtml(thread.meta)}</small></span>
      ${thread.delta ? `<span class="sidebar-thread-delta">${escapeHtml(thread.delta)}</span>` : ""}
    </button>`).join("");

  const modelCount = state.providers.reduce((total, provider) => total + provider.models.length, 0);
  const providerOptions = state.providers.map((provider) => `<option value="${escapeHtml(provider.name)}">${escapeHtml(provider.name)}</option>`).join("");
  const modelOptions = state.providers.flatMap((provider) => provider.models.map((model) => `<option value="${escapeHtml(provider.id + "/" + model.id)}">${escapeHtml(provider.name + " / " + model.displayName)}</option>`)).join("");
  const firstModelKey = state.providers.flatMap((provider) => provider.models.map((model) => provider.id + "/" + model.id))[0] ?? "";
  const firstModelLimits = defaultLimitsForModel(firstModelKey.split("/").slice(1).join("/"));
  const modelLimitsCatalogJson = JSON.stringify(Object.fromEntries(state.providers.flatMap((provider) => provider.models.map((model) => [provider.id + "/" + model.id, model])))).replace(/</g, "\\u003c");
  const providerCatalogJson = JSON.stringify(Object.fromEntries(state.providers.map((provider) => [provider.name, {
    baseUrl: provider.baseUrl,
    defaultModel: provider.models[0]?.id ?? "",
    iconId: provider.iconId,
    description: provider.description,
    models: provider.models
  }]))).replace(/</g, "\\u003c");
  const defaultModel = state.config.defaultModel || "glm-5.1";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Magnexis Agent Studio</title>
  <style>
    :root {
      color-scheme: dark;
      --radius: 10px;
      --background: #070707;
      --foreground: #f3f4f6;
      --card: #101010;
      --card-raised: #151515;
      --sidebar: #0c0c0c;
      --surface-hover: #181818;
      --border: rgba(255, 255, 255, 0.10);
      --border-strong: rgba(255, 255, 255, 0.16);
      --ring: #9ca3af;
      --text: var(--foreground);
      --muted: #a0a7b1;
      --faint: #737b86;
      --blue: #f5f5f5;
      --blue-soft: rgba(255, 255, 255, 0.10);
      --green: #58c889;
      --green-soft: rgba(88, 200, 137, 0.12);
      --amber: #e2ae56;
      --amber-soft: rgba(226, 174, 86, 0.12);
      --danger: #ef7070;
      --shadow: 0 18px 44px rgba(0, 0, 0, 0.46);
      --canvas: #000000;
      --frame: #050505;
      --rail: var(--sidebar);
      --surface: var(--card);
      --surface-raised: var(--card-raised);
      ${magnexisInteractiveTokensCss}
    }
    ${magnexisInteractiveComponentsCss}
    * { box-sizing: border-box; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      padding: 26px 28px;
      background:
        radial-gradient(circle at 16% 22%, rgba(255, 255, 255, 0.06), transparent 24%),
        radial-gradient(circle at 82% 78%, rgba(255, 255, 255, 0.04), transparent 28%),
        linear-gradient(180deg, #0a0a0a 0%, #050505 100%);
      color: var(--text);
      font-family: Inter, "Segoe UI", system-ui, sans-serif;
      font-size: 13px;
      letter-spacing: 0;
    }
    button, input { font: inherit; letter-spacing: 0; }
    button { cursor: pointer; }
    .desktop-frame {
      width: min(1240px, 100%);
      min-height: min(860px, calc(100vh - 52px));
      margin: 0 auto;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      background: rgba(11, 11, 12, 0.96);
      box-shadow: 0 26px 72px rgba(0, 0, 0, 0.46);
      backdrop-filter: blur(18px);
      display: grid;
      grid-template-rows: 40px minmax(0, 1fr);
    }
    .titlebar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(10, 10, 10, 0.94);
      user-select: none;
      -webkit-app-region: drag;
    }
    .title-brand {
      display: flex;
      align-items: center;
      gap: 9px;
      padding-left: 14px;
      min-width: 0;
    }
    .app-mark {
      width: 8px;
      height: 8px;
      display: block;
      border-radius: 999px;
      background: #ffb932;
      box-shadow: -14px 0 0 #fb6058, 14px 0 0 #2ccf53;
      color: transparent;
      font-size: 0;
    }
    .app-mark img { display: none; }
    .title-brand strong { font-size: 11px; font-weight: 620; }
    .title-brand span { color: var(--faint); font-size: 10px; }
    .window-title { color: var(--muted); font-size: 12px; }
    .command-trigger { width: clamp(220px, 28vw, 360px); min-height: 28px; padding: 4px 7px 4px 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 8px; background: rgba(255, 255, 255, 0.025); color: var(--muted); }
    .command-trigger, .window-control { -webkit-app-region: no-drag; }
    .command-trigger:hover { border-color: rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.04); color: var(--text); }
    .command-trigger-label { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .command-trigger kbd { padding: 3px 5px; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 4px; background: rgba(255, 255, 255, 0.02); color: var(--faint); font-family: inherit; font-size: 8px; }
    .window-controls { justify-self: end; display: flex; align-self: stretch; }
    .window-control {
      width: 24px;
      border: 0;
      background: transparent;
      color: transparent;
      font-size: 0;
    }
    .window-control:hover { background: transparent; }
    .window-control.close:hover { background: transparent; }
    .app-layout {
      min-height: 0;
      display: grid;
      grid-template-columns: 258px minmax(0, 1fr);
    }
    .icon-rail {
      padding: 12px 10px 10px;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.03);
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 12px;
    }
    .rail-button {
      width: 100%;
      min-height: 34px;
      padding: 7px 9px;
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      align-items: center;
      justify-items: start;
      gap: 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--faint);
      text-align: left;
    }
    .rail-button:hover { color: var(--text); }
    .rail-button.active {
      border-color: var(--interactive-border-selected);
      background: var(--interactive-bg-selected);
      color: var(--text);
    }
    .rail-icon {
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
    }
    .rail-label { font-size: 11px; line-height: 1.15; white-space: nowrap; }
    .rail-group { display: grid; gap: 4px; }
    .rail-group-label {
      padding: 2px 8px 4px;
      color: var(--faint);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .rail-sidebar-card {
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.025);
      display: grid;
      gap: 8px;
    }
    .sidebar-thread-list {
      min-height: 0;
      display: grid;
      gap: 4px;
      align-content: start;
    }
    .sidebar-thread {
      width: 100%;
      min-height: 36px;
      padding: 7px 8px;
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      text-align: left;
    }
    .sidebar-thread:hover { background: rgba(255, 255, 255, 0.04); }
    .sidebar-thread.active {
      border-color: rgba(255, 255, 255, 0.07);
      background: rgba(255, 255, 255, 0.06);
    }
    .sidebar-thread-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #7b7f89;
    }
    .sidebar-thread.active .sidebar-thread-dot { background: #d8dce6; }
    .sidebar-thread-copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }
    .sidebar-thread-copy strong {
      overflow: hidden;
      font-size: 10px;
      font-weight: 560;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sidebar-thread-copy small {
      color: var(--faint);
      font-size: 8px;
    }
    .sidebar-thread-delta {
      color: #9fe1a8;
      font-size: 8px;
      white-space: nowrap;
    }
    .rail-spacer { flex: 1; }
    .profile-button {
      width: 100%;
      height: 34px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      font-weight: 700;
    }
    .main-stage {
      min-width: 0;
      overflow: auto;
      background: #0b0b0c;
    }
    .stage-header {
      position: sticky;
      top: 0;
      z-index: 4;
      min-height: 54px;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(12, 12, 13, 0.94);
      backdrop-filter: blur(18px);
    }
    .stage-title { min-width: 0; }
    .stage-title h1 { margin: 0; font-size: 13px; line-height: 1.2; font-weight: 620; }
    .stage-title p { margin: 3px 0 0; color: var(--muted); font-size: 10px; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .header-actions[hidden] { display: none; }
    .stage-content { padding: 18px; }
    .view-panel { display: grid; gap: 24px; }
    .view-panel[hidden] { display: none; }
    .overview-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      overflow: hidden;
    }
    .overview-item { padding: 15px 17px; border-right: 1px solid var(--border); }
    .overview-item:last-child { border-right: 0; }
    .overview-item span { display: block; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; }
    .overview-item strong { display: block; margin-top: 7px; font-size: 18px; font-weight: 620; }
    .overview-item small { display: block; margin-top: 3px; color: var(--faint); font-size: 11px; }
    .content-section { display: grid; gap: 12px; }
    .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
    .section-heading h2 { margin: 0; font-size: 14px; font-weight: 650; }
    .section-heading p { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
    .text-button { border: 0; background: transparent; color: var(--blue); font-size: 11px; padding: 4px; }
    .provider-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 8px; }
    .provider-catalog-tools { margin-bottom: 10px; display: grid; grid-template-columns: minmax(180px, 1fr) auto; gap: 8px; }
    .provider-search { min-width: 0; height: 34px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 7px; outline: none; background: #000; color: var(--text); font-size: 10px; }
    .provider-search:focus { border-color: #666; }
    .provider-filter-tabs { padding: 3px; display: flex; gap: 2px; border: 1px solid var(--border); border-radius: 7px; background: #050505; }
    .provider-filter-tabs button { min-width: 54px; padding: 4px 8px; border: 0; border-radius: 5px; background: transparent; color: var(--muted); font-size: 9px; }
    .provider-filter-tabs button.active { background: #fff; color: #000; }
    .provider-card[hidden] { display: none; }
    .provider-empty { padding: 28px; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); font-size: 10px; text-align: center; }
    .provider-empty[hidden] { display: none; }
    .provider-card {
      min-width: 0;
      min-height: 156px;
      padding: 12px;
      display: grid;
      grid-template-rows: auto auto minmax(30px, auto) auto;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: #070707;
      transition: border-color 120ms ease, background 120ms ease;
    }
    .provider-card:hover { background: color-mix(in srgb, var(--interactive-bg-hover) 75%, #0b0b0b); }
    .provider-card.selected { border-color: var(--interactive-border-selected); background: color-mix(in srgb, var(--interactive-bg-selected) 75%, #0a0a0a); }
    .provider-heading { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 9px; align-items: center; }
    .provider-mark {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      background: var(--surface-raised);
      font-weight: 750;
      font-size: 10px;
    }
    .provider-mark img { width: 20px; height: 20px; object-fit: contain; border-radius: 4px; }
    .provider-mark.green { color: #8fe0b1; background: var(--green-soft); border-color: rgba(88, 200, 137, 0.28); }
    .provider-mark.blue { color: #fff; background: var(--blue-soft); border-color: rgba(255, 255, 255, 0.3); }
    .provider-mark.amber { color: #f0c77f; background: var(--amber-soft); border-color: rgba(226, 174, 86, 0.3); }
    .provider-name { min-width: 0; }
    .provider-name strong { display: block; font-size: 11px; }
    .provider-name span { display: block; margin-top: 3px; overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .provider-status { padding: 4px 6px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); border-radius: 5px; color: var(--muted); font-size: 8px; white-space: nowrap; }
    .provider-status.connected, .provider-status.available { color: #a8dbbd; }
    .provider-status.needs-key { color: #d8bd82; }
    .icon-button { width: 28px; height: 28px; padding: 0; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--muted); }
    .icon-button:hover { border-color: var(--border); background: var(--surface-hover); color: var(--text); }
    .provider-meta { margin-top: 10px; display: flex; align-items: center; gap: 7px; color: var(--faint); font-size: 8px; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); }
    .status-dot.green { background: var(--green); box-shadow: 0 0 0 3px var(--green-soft); }
    .status-dot.blue { background: var(--blue); box-shadow: 0 0 0 3px var(--blue-soft); }
    .status-dot.amber { background: var(--amber); box-shadow: 0 0 0 3px var(--amber-soft); }
    .meta-separator { width: 1px; height: 10px; background: var(--border-strong); }
    .model-list { margin-top: 9px; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 5px; }
    .model-chip { max-width: 100%; min-height: 27px; padding: 4px 6px; overflow: hidden; display: grid; grid-template-columns: 15px minmax(0, 1fr) auto; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 5px; background: #000; color: #cfcfcf; font-size: 8px; text-decoration: none; white-space: nowrap; }
    .model-chip:hover { border-color: var(--border-strong); background: #0d0d0d; }
    .model-chip img { width: 14px; height: 14px; object-fit: contain; border-radius: 3px; }
    .model-chip span { overflow: hidden; text-overflow: ellipsis; }
    .model-chip b { color: var(--faint); font-family: "Cascadia Code", Consolas, monospace; font-size: 7px; font-weight: 500; }
    .dynamic-model-note { padding: 7px 8px; border: 1px dashed var(--border); border-radius: 5px; color: var(--faint); font-size: 8px; }
    .provider-actions { margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
    .provider-actions .button { min-height: 27px; padding: 4px 8px; font-size: 9px; }
    .provider-actions .button.quiet { padding-left: 2px; padding-right: 2px; }
    .task-board { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); overflow: hidden; }
    .task-row { min-height: 72px; padding: 13px 15px; display: grid; grid-template-columns: minmax(220px, 1.5fr) minmax(145px, .7fr) minmax(120px, .55fr) auto; align-items: center; gap: 14px; border-bottom: 1px solid var(--border); }
    .task-row[hidden] { display: none; }
    .task-row:last-child { border-bottom: 0; }
    .task-row:hover { background: var(--surface-raised); }
    .task-main strong { display: block; font-size: 12px; }
    .task-main span, .task-model span { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; }
    .task-model strong { font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; font-weight: 500; }
    .progress-wrap { display: grid; gap: 7px; }
    .progress-label { display: flex; justify-content: space-between; color: var(--muted); font-size: 9px; }
    .progress-track { height: 4px; overflow: hidden; border-radius: 3px; background: #000; }
    .progress-value { height: 100%; border-radius: inherit; background: var(--blue); }
    .task-state { justify-self: start; padding: 5px 7px; border-radius: 5px; font-size: 9px; font-weight: 650; }
    .task-state.running { background: var(--blue-soft); color: #fff; }
    .task-state.waiting { background: var(--amber-soft); color: #efc579; }
    .task-state.complete { background: var(--green-soft); color: #8ee0b0; }
    .approval-card { padding: 15px; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 1px solid rgba(226, 174, 86, 0.32); border-radius: 8px; background: rgba(226, 174, 86, 0.055); }
    .approval-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: var(--amber-soft); color: var(--amber); font-weight: 750; }
    .approval-copy strong { display: block; font-size: 12px; }
    .approval-copy code { display: block; margin-top: 5px; color: #d2d6dc; font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; white-space: normal; }
    .approval-copy span { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; }
    .approval-actions { display: flex; gap: 7px; }
    .diff-workbench { min-height: 540px; display: grid; grid-template-columns: 230px minmax(0, 1fr); overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
    .diff-files { border-right: 1px solid var(--border); background: #030303; }
    .diff-files-head { padding: 13px; border-bottom: 1px solid var(--border); }
    .diff-files-head strong { display: block; font-size: 10px; }
    .diff-files-head span { display: block; margin-top: 4px; color: var(--muted); font-size: 9px; }
    .diff-file { width: 100%; min-height: 58px; padding: 10px 12px; display: grid; gap: 5px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); text-align: left; }
    .diff-file:hover, .diff-file.active { background: var(--surface-raised); }
    .diff-file.active { box-shadow: inset 2px 0 var(--blue); }
    .diff-file code { overflow: hidden; font-family: "Cascadia Code", Consolas, monospace; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .diff-file span { color: var(--muted); font-size: 9px; }
    .diff-file .adds { color: #78dca3; }
    .diff-file .deletes { color: #ef8b8b; }
    .diff-stage { min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
    .diff-stage-head { min-height: 54px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border); }
    .diff-stage-head strong { display: block; font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; }
    .diff-stage-head span { display: block; margin-top: 4px; color: var(--muted); font-size: 9px; }
    .diff-code { overflow: auto; padding: 12px 0; background: #000; font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; line-height: 1.55; }
    .diff-line { min-width: 620px; display: grid; grid-template-columns: 36px 36px 18px minmax(0, 1fr); padding: 1px 12px 1px 0; white-space: pre; }
    .diff-line .line-number { color: #57616e; text-align: right; user-select: none; }
    .diff-line .marker { color: var(--faint); text-align: center; }
    .diff-line.add { background: rgba(88, 200, 137, 0.11); }
    .diff-line.add .marker { color: #68d497; }
    .diff-line.remove { background: rgba(239, 112, 112, 0.1); }
    .diff-line.remove .marker { color: #ef8585; }
    .diff-line.context { color: #aab2bd; }
    .diff-actions { padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--border); }
    .diff-actions-copy strong { display: block; font-size: 10px; }
    .diff-actions-copy span { display: block; margin-top: 4px; color: var(--muted); font-size: 9px; }
    .diff-action-buttons { display: flex; gap: 7px; }
    .inspector {
      display: none;
    }
    .inspector-header { height: 72px; padding: 16px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .inspector-header h2 { margin: 0; font-size: 13px; }
    .live-badge { display: inline-flex; align-items: center; gap: 6px; color: #8fe0b1; font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; }
    .live-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 3px var(--green-soft); }
    .inspector-body { padding: 18px; display: grid; gap: 20px; }
    .run-title { display: grid; gap: 7px; }
    .run-title span { color: var(--faint); font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
    .run-title strong { font-size: 14px; line-height: 1.4; }
    .run-title p { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
    .run-stats { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--border); border-radius: 7px; overflow: hidden; }
    .run-stat { padding: 11px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .run-stat:nth-child(2n) { border-right: 0; }
    .run-stat:nth-last-child(-n+2) { border-bottom: 0; }
    .run-stat span { display: block; color: var(--faint); font-size: 9px; }
    .run-stat strong { display: block; margin-top: 5px; font-size: 11px; }
    .inspector-section { display: grid; gap: 10px; }
    .inspector-label { color: var(--faint); font-size: 9px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.08em; }
    .timeline { display: grid; }
    .timeline-item { position: relative; min-height: 52px; padding: 0 0 15px 25px; }
    .timeline-item:last-child { min-height: 20px; padding-bottom: 0; }
    .timeline-item::before { content: ""; position: absolute; left: 6px; top: 7px; bottom: -4px; width: 1px; background: var(--border-strong); }
    .timeline-item:last-child::before { display: none; }
    .timeline-dot { position: absolute; left: 2px; top: 3px; width: 9px; height: 9px; border: 2px solid #050505; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 1px var(--green); }
    .timeline-item.current .timeline-dot { background: var(--blue); box-shadow: 0 0 0 1px var(--blue), 0 0 0 4px var(--blue-soft); }
    .timeline-item.pending .timeline-dot { background: var(--faint); box-shadow: 0 0 0 1px var(--faint); }
    .timeline-item strong { display: block; font-size: 10px; }
    .timeline-item span { display: block; margin-top: 4px; color: var(--muted); font-size: 9px; line-height: 1.45; }
    .context-list { display: grid; gap: 6px; }
    .context-item { padding: 8px 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); display: flex; justify-content: space-between; gap: 8px; color: var(--muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 9px; }
    .context-item span:last-child { color: var(--faint); }
    .inspector-footer { padding-top: 4px; display: grid; grid-template-columns: 1fr auto; gap: 7px; }
    .chat-layout { min-height: 690px; display: grid; grid-template-columns: minmax(0, 1fr); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; overflow: hidden; background: #0a0a0a; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.26); }
    .thread-list { display: none; }
    .thread-list-header { padding: 4px 6px 14px; display: flex; align-items: center; justify-content: space-between; }
    .thread-list-header strong { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); font-weight: 650; }
    .thread-search-wrap { position: relative; margin: 0 5px 9px; }
    .thread-search-wrap::before { position: absolute; left: 9px; top: 8px; color: var(--faint); content: "\\2315"; font-size: 11px; pointer-events: none; }
    .thread-search { width: 100%; height: 31px; padding: 6px 8px 6px 27px; border: 1px solid var(--border); border-radius: 7px; outline: none; background: #000; color: var(--text); font-size: 10px; }
    .thread-search:focus { border-color: rgba(255, 255, 255, 0.65); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08); }
    .thread-button { width: 100%; padding: 10px 11px; display: grid; gap: 5px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text); text-align: left; transition: background 120ms ease, border-color 120ms ease; }
    .thread-button:hover { background: rgba(255, 255, 255, 0.03); }
    .thread-button[hidden] { display: none; }
    .thread-button.active { border-color: var(--border); background: var(--surface-raised); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18); }
    .thread-button strong { overflow: hidden; font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .thread-button span { color: var(--faint); font-size: 10px; }
    .chat-workspace { min-width: 0; display: grid; grid-template-rows: 48px minmax(0, 1fr) auto; background: #0a0a0a; }
    .chat-toolbar { padding: 0 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255, 255, 255, 0.02); }
    .chat-toolbar-actions { min-width: 0; display: flex; align-items: center; gap: 8px; }
    .chat-toolbar .composer-select-button { max-width: 240px; }
    .select-control, .text-control {
      min-height: 32px;
      padding: 7px 11px;
      border: 1px solid var(--border);
      border-radius: 7px;
      outline: none;
      background: var(--surface);
      color: var(--text);
      font-size: 11px;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .select-control:focus, .text-control:focus, .composer textarea:focus { border-color: rgba(255, 255, 255, 0.65); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08); }
    .mode-tabs { display: flex; gap: 2px; padding: 3px; border: 1px solid var(--border); border-radius: 8px; background: var(--canvas); }
    .mode-tab { min-height: 26px; padding: 4px 11px; border: 0; border-radius: 6px; background: transparent; color: var(--faint); font-size: 10px; font-weight: 550; transition: background 120ms ease, color 120ms ease; }
    .mode-tab:hover { color: var(--muted); }
    .mode-tab.active { background: var(--surface-hover); color: var(--text); }
    .message-list { padding: 26px min(8%, 54px); overflow: auto; display: grid; align-content: start; gap: 22px; background: #0a0a0a; }
    .message { max-width: 680px; display: grid; grid-template-columns: 30px minmax(0, 1fr); column-gap: 14px; row-gap: 6px; align-items: start; }
    .message.user { justify-self: end; max-width: 620px; grid-template-columns: minmax(0, 1fr) 30px; }
    .message-avatar { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid var(--border); }
    .message-avatar.assistant { background: #000; color: #fff; border-color: #464646; }
    .message-avatar.user { background: var(--surface-hover); color: var(--text); }
    .message.user .message-avatar { grid-column: 2; }
    .message-label { grid-column: 2; color: var(--faint); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; }
    .message.user .message-label { grid-column: 1; text-align: right; }
    .message-body { grid-column: 2; padding: 13px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: #dce1e8; font-size: 12px; line-height: 1.7; }
    .message.user .message-body { grid-column: 1; border-color: var(--border); background: var(--surface-raised); border-bottom-right-radius: 4px; }
    .message:not(.user) .message-body { border-bottom-left-radius: 4px; }
    .message.streaming .message-body::after {
      content: "";
      display: inline-block;
      width: 7px;
      height: 14px;
      margin-left: 5px;
      vertical-align: -2px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.58);
      animation: desktop-caret 0.9s ease-in-out infinite;
    }
    @keyframes desktop-caret {
      0%, 100% { opacity: 0.25; }
      50% { opacity: 0.9; }
    }
    .tool-event { grid-column: 2; padding: 10px 13px; display: flex; align-items: center; gap: 9px; border: 1px solid var(--border); border-left: 2px solid var(--blue); border-radius: 7px; background: rgba(255, 255, 255, 0.04); color: var(--muted); font-size: 11px; }
    .tool-event code { color: #cfd6df; font-family: "Cascadia Code", Consolas, monospace; }
    .chat-activity { grid-column: 2; overflow: hidden; border: 1px solid var(--border); border-radius: 9px; background: #080808; }
    .chat-activity-head { min-height: 38px; padding: 8px 11px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--border); }
    .chat-activity-head strong { font-size: 10px; }
    .chat-activity-head span { color: var(--muted); font-size: 9px; }
    .activity-row { min-height: 50px; padding: 8px 10px; display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 9px; border-bottom: 1px solid var(--border); }
    .activity-row:last-child { border-bottom: 0; }
    .activity-row-icon { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid var(--border-strong); border-radius: 6px; color: var(--muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 9px; font-weight: 700; }
    .activity-row.completed .activity-row-icon { border-color: rgba(88, 200, 137, .38); color: var(--green); }
    .activity-row.waiting .activity-row-icon { border-color: rgba(226, 174, 86, .4); color: var(--amber); }
    .activity-row-copy { min-width: 0; }
    .activity-row-copy strong { display: block; font-size: 10px; }
    .activity-row-copy code, .activity-row-copy span { display: block; margin-top: 4px; overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .activity-row-copy code { font-family: "Cascadia Code", Consolas, monospace; }
    .activity-row-actions { display: flex; gap: 5px; }
    .activity-row-actions .button { min-height: 28px; padding: 4px 8px; font-size: 9px; }
    .composer { margin: 0 14px 0; padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 14px; background: rgba(255, 255, 255, 0.03); transition: border-color 120ms ease, box-shadow 120ms ease; }
    .composer:focus-within { border-color: rgba(255, 255, 255, 0.65); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08); }
    .composer textarea { width: 100%; min-height: 58px; resize: vertical; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: 12px; line-height: 1.55; }
    .composer-footer { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .composer-control-row { min-width: 0; display: flex; align-items: center; gap: 6px; flex: 1 1 auto; }
    .composer-icon-button {
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }
    .composer-select-button span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .composer-select-button span:last-child { color: var(--faint); font-size: 10px; }
    .composer-meta {
      margin: 8px 14px 14px;
      padding: 9px 10px;
      display: grid;
      gap: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.018);
    }
    .composer-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .composer-meta-label {
      color: var(--faint);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .composer-meta code {
      padding: 5px 8px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
      font-family: "Cascadia Code", Consolas, monospace;
      font-size: 9px;
      line-height: 1;
      white-space: nowrap;
    }
    .composer-meta-hint {
      margin-left: auto;
      color: var(--muted);
      font-size: 9px;
      white-space: nowrap;
    }
    .context-chips { position: relative; display: flex; flex-wrap: wrap; gap: 6px; }
    .desktop-context-menu {
      position: absolute;
      left: 0;
      bottom: calc(100% + 8px);
      z-index: 12;
      width: min(240px, calc(100vw - 80px));
      padding: 5px;
      display: grid;
      gap: 3px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #0b0b0b;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.44);
    }
    .desktop-context-menu[hidden] { display: none; }
    .desktop-context-menu button {
      width: 100%;
      min-height: 44px;
      padding: 7px 8px;
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      text-align: left;
    }
    .desktop-context-menu button:hover { border-color: var(--border); background: var(--surface-hover); }
    .desktop-context-menu button > span { color: var(--muted); text-align: center; font-size: 10px; }
    .desktop-context-menu button > div { min-width: 0; display: grid; gap: 3px; }
    .desktop-context-menu button strong { font-size: 10px; }
    .desktop-context-menu button small { color: var(--faint); font-size: 8px; line-height: 1.35; }
    .chat-send-button {
      height: 28px;
      padding: 0;
      display: grid;
      place-items: center;
      font-weight: 700;
    }
    .chat-send-button span { font-size: 15px; line-height: 1; transform: translateY(-1px); transform-origin: center; }
    .task-filter-row { display: flex; align-items: center; gap: 6px; }
    .filter-button { min-height: 29px; padding: 5px 9px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--muted); font-size: 9px; }
    .filter-button.active { border-color: var(--interactive-border-selected); background: var(--interactive-bg-selected); color: #fff; }
    .task-detail-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, .6fr); gap: 14px; }
    .panel-card { padding: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
    .panel-card h3 { margin: 0; font-size: 12px; }
    .panel-card > p { margin: 5px 0 0; color: var(--muted); font-size: 10px; line-height: 1.55; }
    .run-table { margin-top: 14px; display: grid; }
    .run-entry { padding: 12px 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; border-top: 1px solid var(--border); }
    .run-entry strong { display: block; font-size: 10px; }
    .run-entry span { display: block; margin-top: 4px; color: var(--muted); font-size: 9px; }
    .run-entry time { color: var(--faint); font-size: 9px; }
    .settings-grid { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 24px; }
    .settings-nav { display: grid; align-content: start; gap: 3px; border-left: 1px solid var(--border); }
    .settings-link { min-height: 40px; padding: 9px 14px; border: 0; border-left: 2px solid transparent; border-radius: 0; background: transparent; color: var(--muted); text-align: left; font-size: 11px; font-weight: 500; transition: color 120ms ease, border-color 120ms ease, background 120ms ease; }
    .settings-link:hover { color: var(--text); }
    .settings-link.active { color: var(--text); border-left-color: var(--interactive-border-selected); background: var(--surface); font-weight: 600; }
    .settings-content { display: grid; gap: 16px; }
    .setting-group { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: hidden; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14); }
    .setting-group-header { padding: 16px 18px; border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, 0.015); }
    .setting-group-header h3 { margin: 0; font-size: 13px; font-weight: 620; }
    .setting-group-header p { margin: 5px 0 0; color: var(--muted); font-size: 10.5px; }
    .setting-row { min-height: 70px; padding: 14px 18px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px; border-bottom: 1px solid var(--border); }
    .setting-row:last-child { border-bottom: 0; }
    .setting-copy strong { display: block; font-size: 11.5px; font-weight: 600; }
    .setting-copy span { display: block; margin-top: 5px; color: var(--muted); font-size: 10.5px; line-height: 1.5; }
    .toggle { position: relative; width: 40px; height: 23px; padding: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--canvas); cursor: pointer; transition: background 160ms ease, border-color 160ms ease; }
    .toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: var(--faint); transition: 160ms cubic-bezier(0.4, 0, 0.2, 1); }
    .toggle.on { border-color: rgba(255, 255, 255, 0.6); background: rgba(255, 255, 255, 0.16); }
    .toggle.on::after { left: 20px; background: var(--blue); }
    .role-list { display: grid; gap: 9px; }
    .role-row { padding: 11px 13px; display: grid; grid-template-columns: 140px minmax(0, 1fr); align-items: center; gap: 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--canvas); }
    .role-row label { color: var(--muted); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .model-budget-panel { padding: 16px 18px 18px; display: grid; gap: 12px; }
    .model-budget-selector { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 10px; }
    .verified-model-meta { padding: 10px 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--canvas); }
    .verified-model-meta strong { display: block; font-size: 10px; }
    .verified-model-meta span { display: block; margin-top: 4px; color: var(--muted); font-size: 9px; }
    .verified-model-meta a { color: var(--text); font-size: 9px; }
    .limit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .limit-field { display: grid; gap: 5px; }
    .limit-field label { color: var(--muted); font-size: 9px; }
    .limit-field input { width: 100%; height: 34px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 7px; outline: 0; background: #000; color: var(--text); font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; }
    .limit-field input:focus { border-color: #666; }
    .budget-note { margin: 0; color: var(--faint); font-size: 9px; line-height: 1.5; }
    .auth-status-card { margin: 18px; padding: 16px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; border: 1px solid var(--border); border-radius: 10px; background: #060606; }
    .auth-status-copy strong { display: block; margin-top: 6px; font-size: 14px; font-weight: 620; }
    .auth-status-copy p { margin: 8px 0 0; color: var(--muted); font-size: 10.5px; line-height: 1.6; }
    .auth-button-row { padding: 0 18px 18px; display: flex; flex-wrap: wrap; gap: 8px; }
    .auth-note { padding: 0 18px 18px; }
    .tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .tool-card { min-width: 0; padding: 18px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); display: grid; gap: 14px; transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease; }
    .tool-card:hover, .tool-card.lifted { border-color: var(--border-strong); transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22); }
    .tool-card[hidden] { display: none; }
    .tool-heading { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 12px; align-items: center; }
    .tool-mark { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 8px; background: var(--canvas); font-weight: 700; font-size: 12px; }
    .tool-mark.low { color: #93dcc4; background: rgba(88, 200, 137, 0.08); border-color: rgba(88, 200, 137, 0.22); }
    .tool-mark.medium { color: #e9cf94; background: rgba(226, 174, 86, 0.08); border-color: rgba(226, 174, 86, 0.22); }
    .tool-mark.high { color: #ee9e9e; background: rgba(239, 112, 112, 0.08); border-color: rgba(239, 112, 112, 0.24); }
    .tool-name strong { display: block; font-size: 13px; font-weight: 620; }
    .tool-name span { display: block; margin-top: 3px; color: var(--faint); font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; }
    .task-state.risk { padding: 4px 9px; border-radius: 6px; font-size: 9px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; }
    .task-state.risk.low { background: rgba(88, 200, 137, 0.1); color: #93dcc4; }
    .task-state.risk.medium { background: rgba(226, 174, 86, 0.1); color: #e9cf94; }
    .task-state.risk.high { background: rgba(239, 112, 112, 0.1); color: #ee9e9e; }
    .tool-description { margin: 0; color: var(--muted); font-size: 11.5px; line-height: 1.6; }
    .tool-args { display: grid; gap: 8px; }
    .arg-list { display: grid; gap: 5px; }
    .arg-row { display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--canvas); font-size: 10px; }
    .arg-row code { color: #cfd6df; font-family: "Cascadia Code", Consolas, monospace; }
    .arg-row span { color: var(--faint); }
    .tool-footer { padding-top: 13px; border-top: 1px solid var(--border); display: grid; gap: 9px; }
    .tool-approval { font-size: 10px; font-weight: 550; display: inline-flex; align-items: center; gap: 6px; }
    .tool-approval::before { content: ""; width: 6px; height: 6px; border-radius: 50%; }
    .tool-approval.safe { color: #93dcc4; }
    .tool-approval.safe::before { background: #58c889; }
    .tool-approval.gated { color: #e9cf94; }
    .tool-approval.gated::before { background: #e2ae56; }
    .tool-example { padding: 8px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--canvas); color: #c5cbd3; font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; overflow-x: auto; white-space: nowrap; }
    .tool-registry-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .tool-registry-actions > span { color: var(--faint); font-family: "Cascadia Code", Consolas, monospace; font-size: 9px; }
    .tool-register-panel { padding: 14px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, .6fr) auto; gap: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
    .tool-register-panel[hidden] { display: none; }
    .tool-register-panel input { min-width: 0; height: 34px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 7px; background: #000; color: var(--text); }
    .panel-card code { color: #cfd6df; font-family: "Cascadia Code", Consolas, monospace; }
    .task-state.danger { background: rgba(239, 112, 112, 0.12); color: #f0a0a0; }
    .modal-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 24px; background: rgba(3, 5, 8, 0.74); backdrop-filter: blur(8px); }
    .modal-backdrop[hidden] { display: none; }
    .modal { width: min(540px, 100%); overflow: hidden; border: 1px solid var(--border-strong); border-radius: 14px; background: var(--frame); box-shadow: 0 32px 90px rgba(0, 0, 0, 0.56); }
    .modal-header { padding: 20px 22px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, 0.015); }
    .modal-header h2 { margin: 0; font-size: 15px; font-weight: 650; }
    .modal-header p { margin: 6px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .modal-body { padding: 22px; display: grid; gap: 16px; }
    .field { display: grid; gap: 7px; }
    .field[hidden] { display: none; }
    .field label { color: var(--text); font-size: 10.5px; font-weight: 620; text-transform: uppercase; letter-spacing: 0.06em; }
    .field-label-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .field-label-row button { padding: 2px 0; border: 0; background: transparent; color: var(--text); font-size: 10px; }
    .field-label-row button:hover { text-decoration: underline; }
    .field-label-row button:disabled { color: var(--faint); cursor: wait; text-decoration: none; }
    .field-hint { color: var(--faint); font-size: 10px; line-height: 1.5; }
    .provider-modal-summary { padding: 10px; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: 8px; background: #000; }
    .provider-modal-summary img { width: 34px; height: 34px; padding: 5px; object-fit: contain; border: 1px solid var(--border); border-radius: 7px; background: #0c0c0c; }
    .provider-modal-summary strong { display: block; font-size: 11px; }
    .provider-modal-summary span { display: block; margin-top: 3px; color: var(--muted); font-size: 9px; }
    .provider-modal-summary em { color: var(--faint); font-size: 8px; font-style: normal; }
    .auth-modal { width: min(560px, 100%); }
    .auth-mode-tabs { display: inline-flex; padding: 3px; gap: 4px; border: 1px solid var(--border); border-radius: 8px; background: #050505; }
    .auth-mode-tab { min-width: 120px; min-height: 34px; padding: 7px 12px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-weight: 560; }
    .auth-mode-tab.active { background: #ffffff; color: #000000; }
    .auth-form { display: grid; gap: 16px; }
    .auth-inline-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .modal-footer { padding: 15px 22px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border); background: rgba(255, 255, 255, 0.012); }
    .command-modal { width: min(620px, 100%); overflow: hidden; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--frame); box-shadow: 0 32px 90px rgba(0, 0, 0, 0.6); }
    .command-search-wrap { padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
    .command-search { width: 100%; height: 38px; padding: 8px 10px; border: 0; outline: 0; background: transparent; color: var(--text); font-size: 13px; }
    .command-search-wrap kbd { padding: 4px 7px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--faint); font-family: inherit; font-size: 9px; }
    .command-results { max-height: min(520px, 65vh); padding: 7px; overflow-y: auto; }
    .command-group-label { padding: 8px 9px 5px; color: var(--faint); font-size: 8px; font-weight: 650; text-transform: uppercase; letter-spacing: .08em; }
    .command-item { width: 100%; min-height: 50px; padding: 8px 10px; display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 10px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--text); text-align: left; }
    .command-item:hover, .command-item.active { border-color: var(--border); background: var(--surface-raised); }
    .command-item[hidden] { display: none; }
    .command-icon { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 6px; background: var(--canvas); color: var(--muted); font-size: 10px; font-weight: 700; }
    .command-copy { min-width: 0; }
    .command-copy strong { display: block; font-size: 10px; }
    .command-copy span { display: block; margin-top: 4px; overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .command-item kbd { color: var(--faint); font-family: inherit; font-size: 8px; }
    .toast { position: fixed; z-index: 30; right: 28px; bottom: 28px; max-width: 320px; padding: 11px 14px; border: 1px solid var(--border-strong); border-radius: 7px; background: #111; color: var(--text); box-shadow: var(--shadow); opacity: 0; transform: translateY(8px); pointer-events: none; transition: 160ms ease; }
    .toast.visible { opacity: 1; transform: translateY(0); }
    .stats-view .app-layout { grid-template-columns: 258px minmax(0, 1fr); }
    .stats-view .inspector { display: none; }
    .stats-view .desktop-frame { height: calc(100vh - 36px); min-height: 0; }
    .stats-view .main-stage { min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; }
    .stats-view .stage-content { min-height: 0; overflow: hidden; padding: 12px; display: grid; }
    .stats-view [data-panel="stats"] { height: 100%; min-height: 0; }
    .stats-portal { height: 100%; min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: #050505; }
    .stats-browser-bar { min-height: 48px; padding: 8px 12px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); background: #090909; }
    .stats-browser-controls { display: flex; gap: 5px; }
    .stats-browser-controls button { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--muted); font-size: 11px; }
    .stats-browser-controls button:hover:not(:disabled) { border-color: var(--border); background: var(--surface-raised); color: var(--text); }
    .stats-browser-controls button:disabled { color: #3d3d3d; cursor: default; }
    .stats-address { min-width: 0; height: 30px; padding: 6px 10px; overflow: hidden; border: 1px solid var(--border); border-radius: 6px; background: #000; color: var(--muted); font-family: "Cascadia Code", Consolas, monospace; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .external-badge { padding: 5px 7px; border: 1px solid var(--border); border-radius: 5px; color: var(--muted); font-size: 8px; white-space: nowrap; }
    .stats-privacy { padding: 12px 16px; display: flex; align-items: flex-start; gap: 10px; border-bottom: 1px solid var(--border); background: rgba(255, 255, 255, 0.015); }
    .stats-privacy-mark { flex: 0 0 auto; width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 10px; }
    .stats-privacy strong { display: block; font-size: 10px; }
    .stats-privacy p { margin: 4px 0 0; color: var(--muted); font-size: 9px; line-height: 1.5; }
    .stats-viewport { position: relative; min-height: 0; overflow: hidden; background: #fff; }
    .stats-native-target { position: absolute; inset: 0; }
    .stats-preview-fallback { position: absolute; inset: 0; padding: 34px; display: grid; place-content: center; justify-items: center; gap: 10px; background: #050505; color: var(--text); text-align: center; }
    .stats-preview-fallback strong { font-size: 16px; }
    .stats-preview-fallback p { max-width: 480px; margin: 0; color: var(--muted); font-size: 10px; line-height: 1.6; }
    .desktop-runtime .stats-preview-fallback { display: none; }
    @media (max-width: 1180px) {
      .app-layout { grid-template-columns: 224px minmax(0, 1fr); }
    }
    @media (max-width: 860px) {
      body { padding: 0; }
      .desktop-frame { min-height: 100vh; border: 0; border-radius: 0; }
      .app-layout { grid-template-columns: 1fr; }
      .icon-rail { display: none; }
      .provider-grid { grid-template-columns: 1fr; }
      .provider-catalog-tools { grid-template-columns: 1fr; }
      .task-row { grid-template-columns: 1fr auto; }
      .task-model, .progress-wrap { display: none; }
      .overview-strip { grid-template-columns: 1fr; }
      .overview-item { border-right: 0; border-bottom: 1px solid var(--border); }
      .overview-item:last-child { border-bottom: 0; }
      .approval-card { grid-template-columns: 34px 1fr; }
      .approval-actions { grid-column: 1 / -1; }
      .diff-workbench { grid-template-columns: 1fr; }
      .diff-files { display: none; }
      .diff-actions { align-items: flex-start; flex-direction: column; }
      .chat-layout, .settings-grid, .task-detail-grid, .tool-grid { grid-template-columns: 1fr; }
      .thread-list, .settings-nav { display: none; }
      .activity-row { grid-template-columns: 28px minmax(0, 1fr); }
      .activity-row-actions { grid-column: 1 / -1; justify-content: flex-end; }
      .command-trigger { width: 190px; }
      .command-trigger-label { max-width: 110px; }
      .stats-view .app-layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="desktop-frame">
    <header class="titlebar">
      <div class="title-brand">
        <span class="app-mark"><img src="../../../media/magnexis-mark.svg" alt=""></span>
        <strong>Magnexis</strong>
        <span>Agent Studio</span>
      </div>
      <button class="window-title command-trigger" id="commandTrigger" type="button" aria-label="Open command palette"><span class="command-trigger-label">Project Chat</span><kbd>Ctrl K</kbd></button>
      <div class="window-controls" aria-label="Window controls">
        <button class="window-control" type="button" aria-label="Minimize">&#8722;</button>
        <button class="window-control" type="button" aria-label="Maximize">&#9633;</button>
        <button class="window-control close" type="button" aria-label="Close">&#215;</button>
      </div>
    </header>

    <div class="app-layout">
      <nav class="icon-rail" aria-label="Main navigation">
        <div class="rail-group">
          ${navigation}
        </div>
        <section class="rail-sidebar-card" aria-label="Workspace threads">
          <div class="rail-group-label">Threads</div>
          <div class="sidebar-thread-list">
            ${sidebarThreads}
          </div>
        </section>
        <div class="rail-spacer"></div>
        <button class="profile-button" id="desktopProfileButton" type="button" aria-label="Open account menu" title="Account">SO</button>
      </nav>

      <main class="main-stage">
        <header class="stage-header">
          <div class="stage-title">
            <h1 id="stageTitle">Project Chat</h1>
            <p id="stageDescription">Work with repository context, attached files, and reviewable agent actions.</p>
          </div>
          <div class="header-actions" id="providerHeaderActions">
            <button class="button" id="refreshProviders" type="button">Refresh</button>
            <button class="button primary" id="addProvider" type="button">+ Add provider</button>
          </div>
          <div class="header-actions" id="chatHeaderActions" hidden>
            <button class="button" id="clearThread" type="button">Clear thread</button>
            <button class="button primary" id="newThread" type="button">+ New thread</button>
          </div>
          <div class="header-actions" id="agentHeaderActions" hidden>
            <button class="button" id="exportLogs" type="button">Export logs</button>
            <button class="button primary" id="newTask" type="button">+ New task</button>
          </div>
          <div class="header-actions" id="diffHeaderActions" hidden>
            <button class="button" id="rejectAllDiffs" type="button">Reject all</button>
            <button class="button primary" id="applyAllDiffs" type="button">Apply all changes</button>
          </div>
          <div class="header-actions" id="toolsHeaderActions" hidden>
            <button class="button" id="exportToolManifest" type="button">Export manifest</button>
            <button class="button" id="addToolManifest" type="button">+ Add manifest</button>
            <button class="button primary" id="reviewApprovals" type="button">Review approvals</button>
          </div>
          <div class="header-actions" id="settingsHeaderActions" hidden>
            <button class="button primary" id="saveSettings" type="button">Save settings</button>
          </div>
          <div class="header-actions" id="statsHeaderActions" hidden>
            <button class="button external-link" type="button" data-external-url="https://llm-stats.com/">Open externally &#8599;</button>
          </div>
        </header>

        <div class="stage-content">
          <section class="view-panel" data-panel="providers" hidden>
          <section class="overview-strip" aria-label="Provider overview">
            <div class="overview-item">
              <span>Connected providers</span>
              <strong>2 / ${state.providers.length}</strong>
              <small>One provider needs attention</small>
            </div>
            <div class="overview-item">
              <span>Available models</span>
              <strong>${modelCount}</strong>
              <small>Cloud and local routing</small>
            </div>
            <div class="overview-item">
              <span>Default coding model</span>
              <strong>${escapeHtml(defaultModel)}</strong>
              <small>${escapeHtml(state.config.defaultProvider)} route</small>
            </div>
          </section>

          <section class="content-section">
            <div class="section-heading">
              <div>
                <h2>Your providers</h2>
                <p>Magnexis routes prompts to these providers under your keys — it runs no model of its own. Keys are encrypted locally and never shown after saving.</p>
              </div>
              <button class="text-button" id="manageRoles" type="button">Manage model roles</button>
            </div>
            <div class="provider-catalog-tools"><input class="provider-search" id="desktopProviderSearch" type="search" placeholder="Search providers or models" aria-label="Search providers"><div class="provider-filter-tabs" role="group" aria-label="Provider filters"><button class="active" type="button" data-catalog-filter="all">All</button><button type="button" data-catalog-filter="cloud">Cloud</button><button type="button" data-catalog-filter="local">Local</button><button type="button" data-catalog-filter="needs-key">Needs key</button></div></div>
            <div class="provider-grid">${providerCards}</div>
            <div class="provider-empty" id="desktopProviderEmpty" hidden>No providers match this filter.</div>
          </section>

          <section class="content-section">
            <div class="section-heading">
              <div>
                <h2>Global agent tasks</h2>
                <p>Active work across projects, models, and permission boundaries.</p>
              </div>
              <button class="text-button view-all-runs" type="button">View all runs</button>
            </div>
            <div class="task-board">
              <div class="task-row">
                <div class="task-main"><strong>Harden authentication callback flow</strong><span>magnexis-web &middot; 7 files inspected</span></div>
                <div class="task-model"><strong>z.ai / glm-5.1</strong><span>Reasoning route</span></div>
                <div class="progress-wrap"><div class="progress-label"><span>Analyzing</span><span>68%</span></div><div class="progress-track"><div class="progress-value" style="width:68%"></div></div></div>
                <span class="task-state running">Running</span>
              </div>
              <div class="task-row">
                <div class="task-main"><strong>Generate integration tests for billing API</strong><span>platform-api &middot; command approval required</span></div>
                <div class="task-model"><strong>openai / gpt-5.4</strong><span>Test route</span></div>
                <div class="progress-wrap"><div class="progress-label"><span>Paused</span><span>42%</span></div><div class="progress-track"><div class="progress-value" style="width:42%;background:var(--amber)"></div></div></div>
                <span class="task-state waiting">Approval</span>
              </div>
              <div class="task-row">
                <div class="task-main"><strong>Refactor project indexer</strong><span>agent-studio &middot; 4 changes applied</span></div>
                <div class="task-model"><strong>ollama / qwen2.5-coder</strong><span>Private route</span></div>
                <div class="progress-wrap"><div class="progress-label"><span>Complete</span><span>100%</span></div><div class="progress-track"><div class="progress-value" style="width:100%;background:var(--green)"></div></div></div>
                <span class="task-state complete">Complete</span>
              </div>
            </div>
          </section>

          <section class="content-section">
            <div class="section-heading">
              <div><h2>Approval gates</h2><p>Nothing leaves the queue until you approve it.</p></div>
              <span class="task-state waiting">1 pending</span>
            </div>
            <article class="approval-card" id="approvalCard">
              <div class="approval-icon">!</div>
              <div class="approval-copy">
                <strong>Terminal command requires approval</strong>
                <code>npm test -- --runInBand src/billing</code>
                <span>Requested by &quot;Generate integration tests for billing API&quot; &middot; Low risk</span>
              </div>
              <div class="approval-actions">
                <button class="button danger" id="denyApproval" type="button">Deny</button>
                <button class="button success" id="approveApproval" type="button">Approve</button>
              </div>
            </article>
          </section>
          </section>

          <section class="view-panel" data-panel="chat">
            <div class="chat-layout">
              <aside class="thread-list">
                <div class="thread-list-header"><strong>Recent threads</strong><button class="icon-button create-thread" type="button" aria-label="Create thread">+</button></div>
                <label class="thread-search-wrap"><span class="sr-only">Search threads</span><input id="desktopThreadSearch" class="thread-search" type="search" placeholder="Search threads"></label>
                <button class="thread-button active" data-thread="auth" type="button"><strong>Authentication callback review</strong><span>Active now / 12 messages</span></button>
                <button class="thread-button" data-thread="indexer" type="button"><strong>Indexer performance pass</strong><span>Yesterday / 8 messages</span></button>
                <button class="thread-button" data-thread="routing" type="button"><strong>Provider routing setup</strong><span>Monday / 16 messages</span></button>
                <button class="thread-button" data-thread="release" type="button"><strong>Release checklist</strong><span>Jun 20 / 6 messages</span></button>
              </aside>
              <section class="chat-workspace">
                <div class="chat-toolbar">
                  <div class="mode-tabs" aria-label="Agent mode">
                    <button class="mode-tab" type="button">Ask</button>
                    <button class="mode-tab" type="button">Edit</button>
                    <button class="mode-tab active" type="button">Agent</button>
                    <button class="mode-tab" type="button">Review</button>
                  </div>
                  <div class="chat-toolbar-actions">
                    <button class="composer-select-button" id="desktopToolbarModelTrigger" type="button" aria-label="Choose model" title="Choose model"><span id="desktopToolbarModelLabel">Z.ai / GLM-5.1</span><span aria-hidden="true">&#9662;</span></button>
                  </div>
                </div>
                <div class="message-list" id="messageList">
                  <article class="message user"><span class="message-avatar user" aria-hidden="true">U</span><span class="message-label">You</span><div class="message-body">Review the authentication callback flow and identify why sessions sometimes disappear after redirect.</div></article>
                  <article class="message"><span class="message-avatar assistant" aria-hidden="true">AI</span><span class="message-label">Assistant</span><div class="message-body">I traced the callback route, session helper, and middleware. The redirect currently happens before the refreshed session cookie is committed in one server path. I am comparing the affected branches now and will propose a small reviewable patch.</div><div class="chat-activity"><div class="chat-activity-head"><strong>Agent activity</strong><span>2 completed / 1 awaiting approval</span></div><div class="activity-row completed"><span class="activity-row-icon">R</span><div class="activity-row-copy"><strong>Read authentication files</strong><span>7 files in the workspace sandbox</span></div><span class="task-state complete">Complete</span></div><div class="activity-row completed"><span class="activity-row-icon">S</span><div class="activity-row-copy"><strong>Searched session references</strong><code>session / callback / redirect</code></div><span class="task-state complete">Complete</span></div><div class="activity-row waiting" id="chatCommandApproval"><span class="activity-row-icon">&gt;</span><div class="activity-row-copy"><strong>Run focused authentication tests</strong><code>npm test -- --runInBand src/auth</code></div><div class="activity-row-actions"><button class="button danger" id="denyChatCommand" type="button">Deny</button><button class="button success" id="approveChatCommand" type="button">Approve</button></div></div></div></article>
                </div>
                <form class="composer" id="chatComposer">
                  <textarea id="chatPrompt" aria-label="Message coding assistant" placeholder="Ask about this project, propose an edit, or run an agent task..."></textarea>
                  <div class="composer-footer">
                    <div class="context-chips">
                      <div class="composer-control-row">
                        <button class="composer-icon-button" type="button" aria-label="Attach" title="Attach">&#43;</button>
                        <button class="composer-select-button" id="desktopComposerModelTrigger" type="button" aria-label="Choose model" title="Choose model"><span id="desktopComposerModelLabel">Z.ai / GLM-5.1</span><span aria-hidden="true">&#9662;</span></button>
                      </div>
                      <div class="desktop-context-menu" id="desktopContextMenu" hidden></div>
                    </div>
                    <button class="chat-send-button" type="submit" aria-label="Send" title="Send"><span aria-hidden="true">&#8593;</span></button>
                  </div>
                </form>
                <div class="composer-meta" aria-label="Composer status">
                  <div class="composer-meta-row">
                    <span class="composer-meta-label">Route</span>
                    <code>provider:z.ai</code>
                    <code>mode:agent</code>
                    <code>approval:manual</code>
                  </div>
                  <div class="composer-meta-row">
                    <span class="composer-meta-label">Context</span>
                    <code>selection</code>
                    <code>file</code>
                    <code>workspace</code>
                    <span class="composer-meta-hint">Threaded local session</span>
                  </div>
                </div>
              </section>
            </div>
          </section>

          <section class="view-panel" data-panel="diffs" hidden>
            <section class="overview-strip" aria-label="Diff overview">
              <div class="overview-item"><span>Files changed</span><strong>3</strong><small>One sensitive path</small></div>
              <div class="overview-item"><span>Line changes</span><strong><span style="color:var(--green)">+42</span> <span style="color:var(--danger)">-18</span></strong><small>Across the proposed patch</small></div>
              <div class="overview-item"><span>Approval state</span><strong>Pending</strong><small>Manual review required</small></div>
            </section>
            <section class="diff-workbench">
              <aside class="diff-files">
                <div class="diff-files-head"><strong>Proposed changes</strong><span>Authentication callback task</span></div>
                <button class="diff-file active" type="button" data-diff-path="src/auth/callback.ts"><code>src/auth/callback.ts</code><span><span class="adds">+18</span> <span class="deletes">-7</span></span></button>
                <button class="diff-file" type="button" data-diff-path="src/auth/session.ts"><code>src/auth/session.ts</code><span><span class="adds">+16</span> <span class="deletes">-8</span></span></button>
                <button class="diff-file" type="button" data-diff-path="middleware.ts"><code>middleware.ts</code><span><span class="adds">+8</span> <span class="deletes">-3</span></span></button>
              </aside>
              <div class="diff-stage">
                <header class="diff-stage-head"><div><strong id="activeDiffPath">src/auth/callback.ts</strong><span>Proposed by Z.ai / GLM-5.1</span></div><span class="task-state waiting">Medium risk</span></header>
                <div class="diff-code" aria-label="Unified diff preview">
                  <div class="diff-line context"><span class="line-number">41</span><span class="line-number">41</span><span class="marker"> </span><span>  const response = await exchangeCodeForSession(code);</span></div>
                  <div class="diff-line context"><span class="line-number">42</span><span class="line-number">42</span><span class="marker"> </span><span>  if (!response.session) return redirectToLogin(request);</span></div>
                  <div class="diff-line remove"><span class="line-number">43</span><span class="line-number"></span><span class="marker">-</span><span>  return Response.redirect(nextUrl);</span></div>
                  <div class="diff-line add"><span class="line-number"></span><span class="line-number">43</span><span class="marker">+</span><span>  const redirect = Response.redirect(nextUrl);</span></div>
                  <div class="diff-line add"><span class="line-number"></span><span class="line-number">44</span><span class="marker">+</span><span>  response.cookies.forEach((cookie) =&gt; {</span></div>
                  <div class="diff-line add"><span class="line-number"></span><span class="line-number">45</span><span class="marker">+</span><span>    redirect.headers.append("Set-Cookie", cookie);</span></div>
                  <div class="diff-line add"><span class="line-number"></span><span class="line-number">46</span><span class="marker">+</span><span>  });</span></div>
                  <div class="diff-line add"><span class="line-number"></span><span class="line-number">47</span><span class="marker">+</span><span>  return redirect;</span></div>
                  <div class="diff-line context"><span class="line-number">44</span><span class="line-number">48</span><span class="marker"> </span><span>}</span></div>
                </div>
                <footer class="diff-actions">
                  <div class="diff-actions-copy"><strong>Session cookie propagation</strong><span>Preserves refreshed cookies before redirecting the callback.</span></div>
                  <div class="diff-action-buttons"><button class="button danger" id="rejectSelectedDiff" type="button">Reject</button><button class="button" id="openSelectedDiff" type="button">Open full diff</button><button class="button success" id="applySelectedDiff" type="button">Apply file</button></div>
                </footer>
              </div>
            </section>
          </section>

          <section class="view-panel" data-panel="agents" hidden>
            <div class="task-filter-row">
              <button class="filter-button active" type="button">All runs</button>
              <button class="filter-button" type="button">Running</button>
              <button class="filter-button" type="button">Needs approval</button>
              <button class="filter-button" type="button">Completed</button>
            </div>
            <div class="task-board">
              <div class="task-row"><div class="task-main"><strong>Harden authentication callback flow</strong><span>workspace &middot; started 4 minutes ago</span></div><div class="task-model"><strong>z.ai / glm-5.1</strong><span>Reasoning route</span></div><div class="progress-wrap"><div class="progress-label"><span>Analyzing</span><span>68%</span></div><div class="progress-track"><div class="progress-value" style="width:68%"></div></div></div><span class="task-state running">Running</span></div>
              <div class="task-row"><div class="task-main"><strong>Generate integration tests for billing API</strong><span>platform-api &middot; waiting 8 minutes</span></div><div class="task-model"><strong>openai / gpt-5.4</strong><span>Test route</span></div><div class="progress-wrap"><div class="progress-label"><span>Paused</span><span>42%</span></div><div class="progress-track"><div class="progress-value" style="width:42%;background:var(--amber)"></div></div></div><span class="task-state waiting">Approval</span></div>
              <div class="task-row"><div class="task-main"><strong>Refactor project indexer</strong><span>agent-studio &middot; finished 31 minutes ago</span></div><div class="task-model"><strong>ollama / qwen2.5-coder</strong><span>Private route</span></div><div class="progress-wrap"><div class="progress-label"><span>Complete</span><span>100%</span></div><div class="progress-track"><div class="progress-value" style="width:100%;background:var(--green)"></div></div></div><span class="task-state complete">Complete</span></div>
            </div>
            <div class="task-detail-grid">
              <article class="panel-card"><h3>Approval queue</h3><p>Commands and file changes waiting for a decision.</p><div class="run-table"><div class="run-entry"><div><strong>Run billing integration tests</strong><span>Terminal command &middot; Low risk</span></div><time>8m</time></div><div class="run-entry"><div><strong>Apply authentication callback patch</strong><span>3 files &middot; Medium risk</span></div><time>Draft</time></div></div></article>
              <article class="panel-card"><h3>Run health</h3><p>Agent execution across all open projects.</p><div class="run-table"><div class="run-entry"><div><strong>Success rate</strong><span>Last 30 runs</span></div><time>93%</time></div><div class="run-entry"><div><strong>Median duration</strong><span>Completed tasks</span></div><time>6m 14s</time></div><div class="run-entry"><div><strong>Manual interventions</strong><span>Approval decisions</span></div><time>11</time></div></div></article>
            </div>
          </section>

          <section class="view-panel" data-panel="tools" hidden>
            <section class="overview-strip" aria-label="Tool overview">
              <div class="overview-item">
                <span>Total tools</span>
                <strong>${state.toolSummary.total}</strong>
                <small>Agent capabilities</small>
              </div>
              <div class="overview-item">
                <span>Require approval</span>
                <strong>${state.toolSummary.requiringApproval}</strong>
                <small>Gated by your approval policy</small>
              </div>
              <div class="overview-item">
                <span>Categories</span>
                <strong>${Object.keys(state.toolSummary.byCategory).length}</strong>
                <small>Filesystem, search, shell, edit</small>
              </div>
            </section>

            <section class="content-section">
              <div class="section-heading">
                <div>
                  <h2>Tool catalog</h2>
                  <p>Every capability the agent can invoke, with its risk level and approval rule.</p>
                </div>
                <button class="text-button" id="toggleApprovalTools" type="button">Show approval-gated only</button>
              </div>
              <form class="tool-register-panel" id="toolRegisterPanel" hidden><input id="toolManifestName" placeholder="Tool name" aria-label="Tool name"><input id="toolManifestCommand" placeholder="Package or MCP URL" aria-label="Package or MCP URL"><button class="button primary" type="submit">Register</button></form>
              <div class="tool-grid" id="toolGrid">${toolCards}</div>
            </section>

            <section class="content-section">
              <div class="section-heading">
                <div><h2>Approval policy</h2><p>How Magnexis gates risky tools across every run.</p></div>
              </div>
              <article class="panel-card">
                <h3>Per-action confirmation</h3>
                <p>In Agent mode, tools marked as requiring approval prompt you before they run. Read-only tools like <code>list_files</code> and <code>read_file</code> execute immediately. Switching to Full Access mode removes the prompts entirely, while Chat mode disables all tools.</p>
                <div class="run-table">
                  <div class="run-entry"><div><strong>Always approved automatically</strong><span>list_files, read_file, search</span></div><time>Low risk</time></div>
                  <div class="run-entry"><div><strong>Confirmed each run</strong><span>apply_edit, run_command</span></div><time>Medium+</time></div>
                </div>
              </article>
            </section>
          </section>

          <section class="view-panel" data-panel="stats" hidden>
            <section class="stats-portal" aria-label="Integrated LLM Stats browser">
              <header class="stats-browser-bar">
                <div class="stats-browser-controls"><button id="statsBack" type="button" aria-label="Go back" title="Back" disabled>&#8592;</button><button id="statsForward" type="button" aria-label="Go forward" title="Forward" disabled>&#8594;</button><button id="statsReload" type="button" aria-label="Reload LLM Stats" title="Reload">&#8635;</button></div>
                <div class="stats-address" id="statsAddress">https://llm-stats.com/</div>
                <span class="external-badge" id="statsLoadState">Integrated view</span>
              </header>
              <div class="stats-privacy">
                <span class="stats-privacy-mark" aria-hidden="true">&#10003;</span>
                <div><strong>Isolated external content</strong><p>This viewport is restricted to llm-stats.com in a sandboxed Electron process. Magnexis does not send API keys, prompts, repository files, or workspace context to it.</p></div>
              </div>
              <div class="stats-viewport" id="statsViewport">
                <div class="stats-native-target" aria-label="LLM Stats website viewport"></div>
                <div class="stats-preview-fallback" id="statsPreviewFallback">
                  <strong>Integrated browser available in the desktop app</strong>
                  <p>The browser preview cannot host Electron native views. Run <code>npm run desktop</code> to use llm-stats.com directly inside Magnexis.</p>
                  <button class="button primary external-link" type="button" data-external-url="https://llm-stats.com/">Open in browser &#8599;</button>
                </div>
              </div>
            </section>
          </section>

          <section class="view-panel" data-panel="settings" hidden>
            <div class="settings-grid">
              <nav class="settings-nav" aria-label="Settings sections"><button class="settings-link active" type="button">Account and sync</button><button class="settings-link" type="button">Agent behavior</button><button class="settings-link" type="button">Model routing</button><button class="settings-link" type="button">Privacy and data</button><button class="settings-link" type="button">Workspace indexing</button><button class="settings-link" type="button">Appearance</button></nav>
              <div class="settings-content">
                <section class="setting-group" id="accountAccess">
                  <div class="setting-group-header"><h3>Account and sync</h3><p>Supabase Auth powers sign-in today while keeping local-only mode available by default.</p></div>
                  <div class="auth-status-card">
                    <div class="auth-status-copy">
                      <span class="inspector-label">Account status</span>
                      <strong id="desktopAuthIdentity">Signed out</strong>
                      <p id="desktopAuthMeta">Local-only mode is active. Sign in to unlock protected cloud features and future sync.</p>
                    </div>
                    <span class="task-state waiting" id="desktopAuthBadge">Signed out</span>
                  </div>
                  <div class="auth-button-row">
                    <button class="button primary" id="desktopSignIn" type="button">Sign in</button>
                    <button class="button" id="desktopSignUp" type="button">Create account</button>
                    <button class="button" id="desktopRefreshSession" type="button">Refresh session</button>
                    <button class="button quiet" id="desktopSignOut" type="button">Sign out</button>
                  </div>
                  <div class="setting-row">
                    <div class="setting-copy"><strong>Protected cloud workflows</strong><span>Example gated surface for future sync, billing, and team features.</span></div>
                    <button class="button" id="desktopProtectedAction" type="button">Open protected feature</button>
                  </div>
                  <p class="budget-note auth-note">OAuth opens the system browser and returns through localhost today. The same account layer is ready for a future <code>magnexis://auth/callback</code> deep link.</p>
                </section>
                <section class="setting-group">
                  <div class="setting-group-header"><h3>Approval policy</h3><p>Control what agents may do inside local projects.</p></div>
                  <div class="setting-row"><div class="setting-copy"><strong>Approval mode</strong><span>Manual mode requires confirmation for every edit and command.</span></div><select class="select-control"><option>Manual approval</option><option>Semi-auto</option><option>Read-only</option><option>Full auto</option></select></div>
                  <div class="setting-row"><div class="setting-copy"><strong>Auto-apply low-risk edits</strong><span>Only applies edits outside sensitive files and protected paths.</span></div><button class="toggle" type="button" role="switch" aria-checked="false"></button></div>
                  <div class="setting-row"><div class="setting-copy"><strong>Allow safe commands</strong><span>Run read-only commands such as tests and status checks without prompting.</span></div><button class="toggle" type="button" role="switch" aria-checked="false"></button></div>
                </section>
                <section class="setting-group" id="modelRoles">
                  <div class="setting-group-header"><h3>Model roles</h3><p>Route each kind of work to the best connected model.</p></div>
                  <div class="setting-row"><div class="setting-copy"><strong>Routing profile</strong><span>Changes are saved locally and shared across desktop projects.</span></div><span class="task-state running">Custom</span></div>
                  <div class="setting-row" style="display:block"><div class="role-list"><div class="role-row"><label>Chat</label><select class="select-control"><option>Z.ai / GLM-5.1</option><option>OpenAI / GPT-5.4</option></select></div><div class="role-row"><label>Fast edits</label><select class="select-control"><option>Ollama / Qwen 2.5 Coder</option><option>Z.ai / GLM-4.7</option></select></div><div class="role-row"><label>Deep reasoning</label><select class="select-control"><option>OpenAI / GPT-5.4</option><option>Z.ai / GLM-5.1</option></select></div><div class="role-row"><label>Local/private</label><select class="select-control"><option>Ollama / Qwen 2.5 Coder</option></select></div></div></div>
                </section>
                <section class="setting-group" id="modelBudgets">
                  <div class="setting-group-header"><h3>Per-model budgets</h3><p>Cap context and throughput below each provider's documented maximum.</p></div>
                  <div class="model-budget-panel">
                    <div class="model-budget-selector"><div class="limit-field"><label for="limitModel">Model</label><select class="select-control" id="limitModel">${modelOptions}</select></div><span class="task-state complete">Verified metadata</span></div>
                    <div class="verified-model-meta"><div><strong id="limitVerification">Official context limit</strong><span id="limitVerificationDetail">Verified against provider documentation on 2026-06-28.</span></div><a id="limitSource" href="#" target="_blank" rel="noreferrer">View source &#8599;</a></div>
                    <div class="limit-grid">
                      <div class="limit-field"><label for="limitContext">Context budget (tokens)</label><input id="limitContext" type="number" min="1024" step="1024" value="${firstModelLimits.maxContextTokens}"></div>
                      <div class="limit-field"><label for="limitOutput">Max output (tokens)</label><input id="limitOutput" type="number" min="256" step="256" value="${firstModelLimits.maxOutputTokens}"></div>
                      <div class="limit-field"><label for="limitRpm">Requests per minute</label><input id="limitRpm" type="number" min="1" value="${firstModelLimits.requestsPerMinute}"></div>
                      <div class="limit-field"><label for="limitTpm">Tokens per minute</label><input id="limitTpm" type="number" min="1000" step="1000" value="${firstModelLimits.tokensPerMinute}"></div>
                    </div>
                    <p class="budget-note">These are local Magnexis guardrails. Provider account limits still apply and may be lower. Context includes input, tool results, reasoning, and output where the provider defines it that way.</p>
                  </div>
                </section>
                <section class="setting-group">
                  <div class="setting-group-header"><h3>Local data</h3><p>Magnexis stays local-first unless you explicitly enable cloud features.</p></div>
                  <div class="setting-row"><div class="setting-copy"><strong>Anonymous telemetry</strong><span>Disabled by default. Provider prompts and source code are never included.</span></div><button class="toggle" type="button" role="switch" aria-checked="false"></button></div>
                  <div class="setting-row"><div class="setting-copy"><strong>Persist agent history</strong><span>Keep local run logs, diffs, and approval decisions on this device.</span></div><button class="toggle on" type="button" role="switch" aria-checked="true"></button></div>
                </section>
              </div>
            </div>
          </section>
        </div>
      </main>

      <aside class="inspector" aria-label="Run summary">
        <header class="inspector-header"><h2>Run summary</h2><span class="live-badge">Live</span></header>
        <div class="inspector-body">
          <section class="run-title">
            <span>Active task</span>
            <strong>Harden authentication callback flow</strong>
            <p>The agent is tracing session state and comparing redirect behavior across the server and client entry points.</p>
          </section>
          <section class="run-stats">
            <div class="run-stat"><span>Elapsed</span><strong>04:18</strong></div>
            <div class="run-stat"><span>Files read</span><strong>7</strong></div>
            <div class="run-stat"><span>Tool calls</span><strong>12</strong></div>
            <div class="run-stat"><span>Context</span><strong>38%</strong></div>
          </section>
          <section class="inspector-section">
            <span class="inspector-label">Timeline</span>
            <div class="timeline">
              <div class="timeline-item"><span class="timeline-dot"></span><strong>Request understood</strong><span>Mapped the auth callback and session boundaries.</span></div>
              <div class="timeline-item"><span class="timeline-dot"></span><strong>Repository inspected</strong><span>Read 7 files and found 3 related routes.</span></div>
              <div class="timeline-item current"><span class="timeline-dot"></span><strong>Analyzing behavior</strong><span>Comparing server cookies with client redirects.</span></div>
              <div class="timeline-item pending"><span class="timeline-dot"></span><strong>Propose edits</strong><span>Diff preview will require approval.</span></div>
              <div class="timeline-item pending"><span class="timeline-dot"></span><strong>Verify</strong><span>Tests and final summary.</span></div>
            </div>
          </section>
          <section class="inspector-section">
            <span class="inspector-label">Attached context</span>
            <div class="context-list">
              <div class="context-item"><span>src/auth/callback.ts</span><span>4.2 KB</span></div>
              <div class="context-item"><span>src/auth/session.ts</span><span>6.8 KB</span></div>
              <div class="context-item"><span>middleware.ts</span><span>2.1 KB</span></div>
            </div>
          </section>
          <div class="inspector-footer">
            <button class="button" id="openRun" type="button">Open run</button>
            <button class="icon-button" id="stopRun" type="button" aria-label="Stop run" title="Stop run">&#9632;</button>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <div class="modal-backdrop" id="providerModal" hidden>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="providerModalTitle">
      <header class="modal-header">
        <div><h2 id="providerModalTitle">Add provider</h2><p>Connect a cloud API or a model server running on this device.</p></div>
        <button class="icon-button" id="closeProviderModal" type="button" aria-label="Close provider setup">&#215;</button>
      </header>
      <form id="providerForm">
        <div class="modal-body">
          <div class="field"><label for="providerType">Provider</label><select class="select-control" id="providerType">${providerOptions}</select></div>
          <div class="provider-modal-summary"><img id="providerModalIcon" src="../../../media/providers/openai.png" alt=""><div><strong id="providerModalName">OpenAI</strong><span id="providerModalDescription">Frontier reasoning and coding</span></div><em id="providerModalModelCount">2 verified models</em></div>
          <div class="field"><label for="providerEndpoint">Base URL</label><input class="text-control" id="providerEndpoint" value="https://api.z.ai/api/paas/v4" autocomplete="off"><span class="field-hint">Magnexis never has its own model — requests are sent straight to this provider endpoint under your API key.</span></div>
          <div class="field"><label for="providerKey">API key</label><input class="text-control" id="providerKey" type="password" placeholder="Enter a key" autocomplete="new-password"><span class="field-hint">Keys are stored with the operating system credential vault and are never written to project config.</span></div>
          <div class="field"><span class="field-label-row"><label for="providerModel">Default model</label><button id="refreshProviderModels" type="button">Refresh models</button></span><select class="select-control" id="providerModel" aria-label="Default model"></select><span class="field-hint" id="providerModelSource">Showing supported presets.</span></div>
          <div class="field" id="providerCustomModelField" hidden><label for="providerCustomModel">Custom model identifier</label><input class="text-control" id="providerCustomModel" autocomplete="off" placeholder="provider-model-name"></div>
        </div>
        <footer class="modal-footer"><button class="button" id="cancelProvider" type="button">Cancel</button><button class="button" id="testProviderModal" type="button">Test connection</button><button class="button primary" type="submit">Save provider</button></footer>
      </form>
    </section>
  </div>
  <div class="modal-backdrop" id="authModal" hidden>
    <section class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
      <header class="modal-header">
        <div><h2 id="authModalTitle">Sign in to Magnexis</h2><p>Use email/password or open a secure browser-based OAuth flow with GitHub or Google.</p></div>
        <button class="icon-button" id="closeAuthModal" type="button" aria-label="Close authentication dialog">&#215;</button>
      </header>
      <div class="modal-body">
        <div class="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button class="auth-mode-tab active" id="authModeSignIn" type="button" data-auth-mode="signin">Sign in</button>
          <button class="auth-mode-tab" id="authModeSignUp" type="button" data-auth-mode="signup">Create account</button>
        </div>
        <form id="authForm" class="auth-form">
          <div class="field"><label for="authEmail">Email</label><input class="text-control" id="authEmail" type="email" autocomplete="username email" placeholder="name@company.com"></div>
          <div class="field"><label for="authPassword">Password</label><input class="text-control" id="authPassword" type="password" autocomplete="current-password" placeholder="Enter your password"></div>
          <div class="auth-inline-actions">
            <button class="button primary" id="authSubmit" type="submit">Sign in</button>
            <button class="button" id="authGithub" type="button">Continue with GitHub</button>
            <button class="button" id="authGoogle" type="button">Continue with Google</button>
          </div>
          <p class="field-hint">Passwords are sent directly to Supabase and never stored locally. OAuth always opens your system browser instead of an embedded webview.</p>
        </form>
      </div>
    </section>
  </div>
  <div class="modal-backdrop" id="commandPalette" hidden>
    <section class="command-modal" role="dialog" aria-modal="true" aria-labelledby="commandSearch">
      <div class="command-search-wrap"><input class="command-search" id="commandSearch" type="text" placeholder="Search views and commands..." autocomplete="off"><kbd>Esc</kbd></div>
      <div class="command-results" id="commandResults">
        <div class="command-group-label">Navigate</div>
        <button class="command-item active" type="button" data-command-view="chat"><span class="command-icon">C</span><span class="command-copy"><strong>Open project chat</strong><span>Continue the active repository conversation</span></span><kbd>Chat</kbd></button>
        <button class="command-item" type="button" data-command-view="diffs"><span class="command-icon">D</span><span class="command-copy"><strong>Review proposed changes</strong><span>Inspect and approve the current diff</span></span><kbd>Diffs</kbd></button>
        <button class="command-item" type="button" data-command-view="agents"><span class="command-icon">A</span><span class="command-copy"><strong>Open agent tasks</strong><span>Monitor runs and approval gates</span></span><kbd>Runs</kbd></button>
        <button class="command-item" type="button" data-command-view="providers"><span class="command-icon">P</span><span class="command-copy"><strong>Manage providers</strong><span>Configure external models and routing</span></span><kbd>Models</kbd></button>
        <button class="command-item" type="button" data-command-view="stats"><span class="command-icon">&#8599;</span><span class="command-copy"><strong>Open model stats</strong><span>Research rankings, benchmarks, and pricing</span></span><kbd>External</kbd></button>
        <button class="command-item" type="button" data-command-view="tools"><span class="command-icon">T</span><span class="command-copy"><strong>Inspect agent tools</strong><span>Review capabilities, risk, and approval rules</span></span><kbd>Tools</kbd></button>
        <button class="command-item" type="button" data-command-view="settings"><span class="command-icon">S</span><span class="command-copy"><strong>Open settings</strong><span>Change safety, context, and local data controls</span></span><kbd>Settings</kbd></button>
        <div class="command-group-label">Actions</div>
        <button class="command-item" type="button" data-command-action="new-task"><span class="command-icon">+</span><span class="command-copy"><strong>Start a new agent task</strong><span>Open Chat in Agent mode with a clean prompt</span></span><kbd>New</kbd></button>
        <button class="command-item" type="button" data-command-action="add-provider"><span class="command-icon">+</span><span class="command-copy"><strong>Add a provider</strong><span>Connect a cloud API or local model server</span></span><kbd>Provider</kbd></button>
      </div>
    </section>
  </div>
  <div class="toast" id="toast" role="status"></div>
  <script>
    const toast = document.getElementById("toast");
    let toastTimer;
    function notify(message) {
      toast.textContent = message;
      toast.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
    }
    function buildDesktopAssistantReply(promptText) {
      if (/provider|openai|response/i.test(promptText)) {
        return "OpenAI routes now prefer the Responses API path in the live runtime. For other providers, Magnexis keeps the OpenAI-compatible fallback transport so routing stays explicit and reversible.";
      }
      if (/auth|session|callback/i.test(promptText)) {
        return "I would inspect the callback route, cookie handoff, and session refresh order first. The safest change is usually to preserve the refreshed session before redirecting and verify that behavior with one focused test command.";
      }
      return "I mapped the request, checked the current workspace context, and would keep the next change small and reviewable. The first pass should inspect the relevant files, explain the plan, and only then propose the patch.";
    }
    const desktopContextMenu = document.getElementById("desktopContextMenu");
    const desktopContextOptions = {
      selection: [
        { icon: "{ }", title: "Attach selection", note: "Add highlighted code from the active editor" },
        { icon: "P", title: "Pin selection", note: "Keep the current selection in this thread" }
      ],
      file: [
        { icon: "▨", title: "Attach current file", note: "Include the active file in context" },
        { icon: "T", title: "Open tabs", note: "Bring visible editor tabs into context" }
      ],
      workspace: [
        { icon: "@", title: "Workspace map", note: "Attach a repo-level workspace summary" },
        { icon: "Δ", title: "Git diff", note: "Attach the current working diff" }
      ],
      approval: [
        { icon: "✓", title: "Manual approval", note: "Require review before edits or commands" },
        { icon: "!", title: "Approval queue", note: "Inspect pending file and command gates" }
      ]
    };
    function openDesktopContextMenu(kind, anchor) {
      const options = desktopContextOptions[kind] || [];
      desktopContextMenu.innerHTML = options.map((option) => '<button type="button" data-context-choice="' + kind + ':' + option.title + '"><span aria-hidden="true">' + option.icon + '</span><div><strong>' + option.title + '</strong><small>' + option.note + '</small></div></button>').join("");
      desktopContextMenu.hidden = false;
      desktopContextMenu.dataset.kind = kind;
      desktopContextMenu.dataset.anchor = anchor?.dataset.chatContext || "";
    }
    function closeDesktopContextMenu() {
      desktopContextMenu.hidden = true;
      desktopContextMenu.innerHTML = "";
    }
    function streamDesktopAssistantReply(promptText) {
      const messageList = document.getElementById("messageList");
      const message = document.createElement("article");
      message.className = "message streaming";
      const avatar = document.createElement("span");
      avatar.className = "message-avatar assistant";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "AI";
      const label = document.createElement("span");
      label.className = "message-label";
      label.textContent = "Assistant";
      const body = document.createElement("div");
      body.className = "message-body";
      message.append(avatar, label, body);
      messageList.append(message);
      const fullText = buildDesktopAssistantReply(promptText);
      let cursor = 0;
      const timer = setInterval(() => {
        cursor += Math.max(1, Math.ceil(Math.random() * 6));
        body.textContent = fullText.slice(0, cursor);
        message.scrollIntoView({ behavior: "smooth", block: "end" });
        if (cursor >= fullText.length) {
          clearInterval(timer);
          message.classList.remove("streaming");
        }
      }, 22);
    }
    const viewCopy = {
      chat: ["Project Chat", "Work with repository context, attached files, and reviewable agent actions."],
      diffs: ["Diff Review", "Inspect every proposed file change before anything is applied."],
      providers: ["Provider Management", "Connect models, assign roles, and monitor availability across every agent run."],
      agents: ["Agent Tasks", "Monitor active work, inspect run health, and resolve approval gates."],
      tools: ["Tools & Capabilities", "Inspect the agent tool catalog, risk levels, and approval gates."],
      stats: ["Model Stats", "Research external model rankings, benchmarks, speed, context, and pricing."],
      settings: ["Settings", "Configure model routing, safety boundaries, indexing, and local data."]
    };
    const headerActions = {
      chat: document.getElementById("chatHeaderActions"),
      diffs: document.getElementById("diffHeaderActions"),
      providers: document.getElementById("providerHeaderActions"),
      agents: document.getElementById("agentHeaderActions"),
      tools: document.getElementById("toolsHeaderActions"),
      stats: document.getElementById("statsHeaderActions"),
      settings: document.getElementById("settingsHeaderActions")
    };
    function setView(view) {
      activeView = view;
      toast.classList.remove("visible");
      document.querySelectorAll(".view-panel").forEach((panel) => panel.hidden = panel.dataset.panel !== view);
      document.querySelectorAll(".rail-button").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
      Object.entries(headerActions).forEach(([key, actions]) => actions.hidden = key !== view);
      document.getElementById("stageTitle").textContent = viewCopy[view][0];
      document.getElementById("stageDescription").textContent = viewCopy[view][1];
      document.querySelector(".command-trigger-label").textContent = viewCopy[view][0];
      document.querySelector(".main-stage").scrollTop = 0;
      document.body.classList.toggle("stats-view", view === "stats");
      window.location.hash = view;
      requestAnimationFrame(syncStatsViewport);
    }
    document.querySelectorAll(".rail-button").forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.view);
      });
    });
    document.querySelectorAll(".sidebar-thread").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".sidebar-thread").forEach((item) => item.classList.toggle("active", item === button));
        setView("chat");
        notify("Opened " + button.querySelector("strong")?.textContent);
      });
    });
    document.querySelectorAll(".external-link").forEach((button) => button.addEventListener("click", async () => {
      const url = button.dataset.externalUrl;
      try {
        if (desktopBridge?.openExternalUrl) await desktopBridge.openExternalUrl(url);
        else window.open(url, "_blank", "noopener,noreferrer");
        notify("Opened LLM Stats in a separate window");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not open the external page");
      }
    }));
    document.querySelectorAll(".provider-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        document.querySelectorAll(".provider-card").forEach((item) => item.classList.remove("selected"));
        card.classList.add("selected");
      });
    });
    let providerCatalogFilter = "all";
    function filterProviderCatalog() {
      const query = document.getElementById("desktopProviderSearch").value.trim().toLowerCase();
      let visible = 0;
      document.querySelectorAll(".provider-card").forEach((card) => {
        const matchesText = !query || card.textContent.toLowerCase().includes(query);
        const matchesFilter = providerCatalogFilter === "all" || card.dataset.providerType === providerCatalogFilter || card.dataset.providerStatus === providerCatalogFilter;
        card.hidden = !(matchesText && matchesFilter);
        if (!card.hidden) visible += 1;
      });
      document.getElementById("desktopProviderEmpty").hidden = visible > 0;
    }
    document.getElementById("desktopProviderSearch").addEventListener("input", filterProviderCatalog);
    document.querySelectorAll("[data-catalog-filter]").forEach((button) => button.addEventListener("click", () => {
      providerCatalogFilter = button.dataset.catalogFilter;
      document.querySelectorAll("[data-catalog-filter]").forEach((item) => item.classList.toggle("active", item === button));
      filterProviderCatalog();
    }));
    document.querySelectorAll(".diff-file").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll(".diff-file").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById("activeDiffPath").textContent = button.dataset.diffPath;
      notify("Loaded " + button.dataset.diffPath);
    }));
    document.getElementById("openSelectedDiff").addEventListener("click", () => notify("Full side-by-side diff opened"));
    document.getElementById("applySelectedDiff").addEventListener("click", () => notify("Selected file approved and applied"));
    document.getElementById("rejectSelectedDiff").addEventListener("click", () => notify("Selected file rejected"));
    document.getElementById("applyAllDiffs").addEventListener("click", () => notify("All proposed changes approved"));
    document.getElementById("rejectAllDiffs").addEventListener("click", () => notify("All proposed changes rejected"));
    const providerModal = document.getElementById("providerModal");
    const authModal = document.getElementById("authModal");
    const commandPalette = document.getElementById("commandPalette");
    const commandSearch = document.getElementById("commandSearch");
    let commandIndex = 0;
    const desktopBridge = window.magnexisDesktop;
    if (desktopBridge) document.body.classList.add("desktop-runtime");
    let authMode = "signin";
    function setAuthMode(mode) {
      authMode = mode;
      document.querySelectorAll(".auth-mode-tab").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
      document.getElementById("authModalTitle").textContent = mode === "signin" ? "Sign in to Magnexis" : "Create your Magnexis account";
      document.getElementById("authSubmit").textContent = mode === "signin" ? "Sign in" : "Create account";
      document.getElementById("authPassword").setAttribute("autocomplete", mode === "signin" ? "current-password" : "new-password");
    }
    function openAuthModal(mode) {
      setAuthMode(mode || "signin");
      authModal.hidden = false;
      document.getElementById("authEmail").focus();
    }
    function closeAuthModal() {
      authModal.hidden = true;
      document.getElementById("authForm").reset();
    }
    function updateDesktopAuthUi(status) {
      const identity = status?.authenticated && status.user
        ? (status.user.email || status.user.username || status.user.displayName || status.user.id)
        : "Signed out";
      const providerLabel = status?.user?.provider ? " via " + status.user.provider : "";
      document.getElementById("desktopAuthIdentity").textContent = identity;
      document.getElementById("desktopAuthMeta").textContent = status?.authenticated
        ? "Cloud account is active" + providerLabel + ". Protected features and future sync surfaces may use this session."
        : "Local-only mode is active. Sign in to unlock protected cloud features and future sync.";
      document.getElementById("desktopAuthBadge").textContent = status?.authenticated ? "Signed in" : "Signed out";
      document.getElementById("desktopAuthBadge").className = "task-state " + (status?.authenticated ? "complete" : "waiting");
      document.getElementById("desktopProfileButton").textContent = status?.authenticated
        ? identity.slice(0, 2).toUpperCase()
        : "SO";
      document.getElementById("desktopProfileButton").title = status?.authenticated ? identity : "Signed out";
    }
    async function refreshDesktopAuthStatus() {
      if (!desktopBridge?.getAuthStatus) {
        updateDesktopAuthUi({ authenticated: false, user: null });
        return;
      }
      try {
        updateDesktopAuthUi(await desktopBridge.getAuthStatus());
      } catch (error) {
        notify(error instanceof Error ? error.message : "Authentication status unavailable");
        updateDesktopAuthUi({ authenticated: false, user: null });
      }
    }
    async function submitDesktopAuth(action, input) {
      if (!desktopBridge?.[action]) {
        notify("Desktop authentication requires the Electron runtime");
        return;
      }
      const button = document.getElementById("authSubmit");
      const previous = button.textContent;
      button.textContent = action === "signUp" ? "Creating..." : "Signing in...";
      button.disabled = true;
      try {
        const status = await desktopBridge[action](input);
        updateDesktopAuthUi(status);
        closeAuthModal();
        notify(status.authenticated ? "Authentication complete" : "Account created. Check email confirmation if enabled.");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Authentication failed");
      } finally {
        button.disabled = false;
        button.textContent = previous;
      }
    }
    const statsViewport = document.getElementById("statsViewport");
    let activeView = "chat";
    function syncStatsViewport() {
      if (!desktopBridge?.layoutStatsView || !statsViewport) return;
      const visible = activeView === "stats";
      const rect = statsViewport.getBoundingClientRect();
      void desktopBridge.layoutStatsView({
        visible,
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      });
    }
    document.getElementById("statsBack").addEventListener("click", () => desktopBridge?.navigateStatsView?.("back"));
    document.getElementById("statsForward").addEventListener("click", () => desktopBridge?.navigateStatsView?.("forward"));
    document.getElementById("statsReload").addEventListener("click", () => desktopBridge?.navigateStatsView?.("reload"));
    if (desktopBridge?.onStatsState) desktopBridge.onStatsState((state) => {
      document.getElementById("statsAddress").textContent = state.url || "https://llm-stats.com/";
      document.getElementById("statsBack").disabled = !state.canGoBack;
      document.getElementById("statsForward").disabled = !state.canGoForward;
      document.getElementById("statsLoadState").textContent = state.error ? "Could not load" : state.loading ? "Loading..." : "Integrated view";
    });
    new ResizeObserver(syncStatsViewport).observe(statsViewport);
    window.addEventListener("resize", syncStatsViewport);
    const providerCatalog = ${providerCatalogJson};
    const verifiedModelCatalog = ${modelLimitsCatalogJson};
    const savedModelLimits = {};
    const providerDefaults = Object.fromEntries(Object.entries(providerCatalog).map(([name, provider]) => [name, [provider.baseUrl, provider.defaultModel]]));
    const providerModelCatalog = Object.fromEntries(Object.entries(providerCatalog).map(([name, provider]) => [name, provider.models.map((model) => model.id)]));
    function updateDesktopActiveModelLabels(providerName, modelName) {
      const provider = (providerName || "Z.ai").trim();
      const model = (modelName || "GLM-5.1").trim();
      const combined = provider + " / " + model;
      const toolbarLabel = document.getElementById("desktopToolbarModelLabel");
      const composerLabel = document.getElementById("desktopComposerModelLabel");
      if (toolbarLabel) toolbarLabel.textContent = combined;
      if (composerLabel) composerLabel.textContent = combined;
    }
    function updateProviderModalSummary(providerName) {
      const provider = providerCatalog[providerName];
      if (!provider) return;
      document.getElementById("providerModalIcon").src = "../../../media/providers/" + provider.iconId + ".png";
      document.getElementById("providerModalName").textContent = providerName;
      document.getElementById("providerModalDescription").textContent = provider.description;
      const verified = provider.models.filter((model) => model.contextWindow).length;
      document.getElementById("providerModalModelCount").textContent = verified ? verified + " verified model" + (verified === 1 ? "" : "s") : "Live catalog";
    }
    function loadModelBudget(modelKey) {
      const model = verifiedModelCatalog[modelKey];
      if (!model) return;
      const defaults = { maxContextTokens: Math.min(model.contextWindow || 131072, 131072), maxOutputTokens: Math.min(model.maxOutputTokens || 16384, model.contextWindow || 131072), requestsPerMinute: 30, tokensPerMinute: Math.min((model.contextWindow || 131072) * 2, 500000) };
      const limits = savedModelLimits[modelKey] || defaults;
      document.getElementById("limitContext").max = String(model.contextWindow || 2000000);
      document.getElementById("limitOutput").max = String(model.maxOutputTokens || model.contextWindow || 300000);
      document.getElementById("limitContext").value = limits.maxContextTokens;
      document.getElementById("limitOutput").value = limits.maxOutputTokens;
      document.getElementById("limitRpm").value = limits.requestsPerMinute;
      document.getElementById("limitTpm").value = limits.tokensPerMinute;
      document.getElementById("limitVerification").textContent = model.contextWindow ? model.contextWindow.toLocaleString() + " token context / " + (model.maxOutputTokens || 0).toLocaleString() + " max output" : "Limits reported by provider endpoint";
      document.getElementById("limitVerificationDetail").textContent = model.contextWindow ? "Verified against provider documentation on " + model.contextVerifiedAt + "." : "Refresh the model catalog after connecting; local limits remain conservative until then.";
      document.getElementById("limitSource").href = model.contextSourceUrl;
    }
    function saveActiveModelBudget() {
      const modelKey = document.getElementById("limitModel").value;
      const model = verifiedModelCatalog[modelKey];
      if (!model) return;
      savedModelLimits[modelKey] = {
        maxContextTokens: Math.min(Number(document.getElementById("limitContext").value), model.contextWindow || 2000000),
        maxOutputTokens: Math.min(Number(document.getElementById("limitOutput").value), model.maxOutputTokens || model.contextWindow || 300000),
        requestsPerMinute: Math.max(1, Number(document.getElementById("limitRpm").value)),
        tokensPerMinute: Math.max(1000, Number(document.getElementById("limitTpm").value))
      };
    }
    document.getElementById("limitModel").addEventListener("change", (event) => loadModelBudget(event.target.value));
    document.querySelectorAll("#modelBudgets input").forEach((input) => input.addEventListener("change", saveActiveModelBudget));
    loadModelBudget(document.getElementById("limitModel").value);
    function populateDesktopModels(providerName, selectedModel, discoveredModels) {
      const select = document.getElementById("providerModel");
      const models = Array.from(new Set([...(discoveredModels || []), ...(providerModelCatalog[providerName] || [])]));
      select.replaceChildren();
      models.forEach((model) => select.add(new Option(model, model)));
      select.add(new Option("Custom model...", "__custom__"));
      if (selectedModel && models.includes(selectedModel)) select.value = selectedModel;
      else if (selectedModel) { select.value = "__custom__"; document.getElementById("providerCustomModel").value = selectedModel; }
      else select.value = models[0] || "__custom__";
      updateDesktopCustomModel();
      if (!discoveredModels) document.getElementById("providerModelSource").textContent = "Showing supported presets.";
    }
    function updateDesktopCustomModel() {
      document.getElementById("providerCustomModelField").hidden = document.getElementById("providerModel").value !== "__custom__";
    }
    function selectedDesktopModel() {
      const select = document.getElementById("providerModel");
      return select.value === "__custom__" ? document.getElementById("providerCustomModel").value.trim() : select.value;
    }
    function openProviderModal(providerName) {
      document.getElementById("providerModalTitle").textContent = providerName ? "Configure " + providerName : "Add provider";
      if (providerName) document.getElementById("providerType").value = providerName;
      const activeProvider = document.getElementById("providerType").value;
      const defaults = providerDefaults[activeProvider];
      updateProviderModalSummary(activeProvider);
      document.getElementById("providerEndpoint").value = defaults[0];
      populateDesktopModels(activeProvider, defaults[1]);
      providerModal.hidden = false;
      document.getElementById("providerType").focus();
    }
    function closeProviderModal() { providerModal.hidden = true; }
    function openCommandPalette() {
      commandPalette.hidden = false;
      commandSearch.value = "";
      filterCommands();
      commandSearch.focus();
    }
    function closeCommandPalette() { commandPalette.hidden = true; }
    function visibleCommands() { return Array.from(document.querySelectorAll(".command-item")).filter((item) => !item.hidden); }
    function selectCommand(index) {
      const items = visibleCommands();
      if (!items.length) return;
      commandIndex = (index + items.length) % items.length;
      document.querySelectorAll(".command-item").forEach((item) => item.classList.remove("active"));
      items[commandIndex].classList.add("active");
      items[commandIndex].scrollIntoView({ block: "nearest" });
    }
    function filterCommands() {
      const query = commandSearch.value.trim().toLowerCase();
      document.querySelectorAll(".command-item").forEach((item) => item.hidden = Boolean(query) && !item.textContent.toLowerCase().includes(query));
      commandIndex = 0;
      selectCommand(0);
    }
    function runCommandItem(item) {
      closeCommandPalette();
      if (item.dataset.commandView) setView(item.dataset.commandView);
      if (item.dataset.commandAction === "new-task") document.getElementById("newTask").click();
      if (item.dataset.commandAction === "add-provider") document.getElementById("addProvider").click();
    }
    document.getElementById("commandTrigger").addEventListener("click", openCommandPalette);
    commandSearch.addEventListener("input", filterCommands);
    commandSearch.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        selectCommand(commandIndex + (event.key === "ArrowDown" ? 1 : -1));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = visibleCommands()[commandIndex];
        if (item) runCommandItem(item);
      }
    });
    document.querySelectorAll(".command-item").forEach((item) => {
      item.addEventListener("mouseenter", () => selectCommand(visibleCommands().indexOf(item)));
      item.addEventListener("click", () => runCommandItem(item));
    });
    commandPalette.addEventListener("click", (event) => { if (event.target === commandPalette) closeCommandPalette(); });
    document.querySelectorAll(".provider-test").forEach((button) => button.addEventListener("click", async () => {
      if (!desktopBridge?.testConfiguredProvider) { notify("Preview mode: testing requires the desktop runtime"); return; }
      button.textContent = "Testing...";
      const result = await desktopBridge.testConfiguredProvider(button.closest(".provider-card").dataset.provider);
      button.textContent = result.ok ? "Connected" : "Retry test";
      notify(result.message);
    }));
    document.querySelectorAll(".provider-configure").forEach((button) => button.addEventListener("click", () => openProviderModal(button.closest(".provider-card").querySelector(".provider-name strong").textContent)));
    document.getElementById("refreshProviders").addEventListener("click", () => notify("Provider status refreshed"));
    document.getElementById("addProvider").addEventListener("click", () => openProviderModal());
    document.querySelectorAll("#desktopToolbarModelTrigger, #desktopComposerModelTrigger").forEach((button) => {
      button.addEventListener("click", () => openProviderModal());
    });
    document.getElementById("providerType").addEventListener("change", (event) => {
      const defaults = providerDefaults[event.target.value];
      updateProviderModalSummary(event.target.value);
      document.getElementById("providerEndpoint").value = defaults[0];
      populateDesktopModels(event.target.value, defaults[1]);
    });
    document.getElementById("providerModel").addEventListener("change", updateDesktopCustomModel);
    document.getElementById("refreshProviderModels").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!desktopBridge?.listProviderModels) { document.getElementById("providerModelSource").textContent = "Live discovery requires the desktop runtime; presets remain available."; return; }
      button.disabled = true;
      button.textContent = "Refreshing...";
      const providerName = document.getElementById("providerType").value;
      const result = await desktopBridge.listProviderModels({ type: providerName, baseUrl: document.getElementById("providerEndpoint").value, model: selectedDesktopModel(), apiKey: document.getElementById("providerKey").value });
      button.disabled = false;
      button.textContent = "Refresh models";
      if (result.ok && result.models.length) {
        populateDesktopModels(providerName, selectedDesktopModel(), result.models);
        document.getElementById("providerModelSource").textContent = result.models.length + " models reported by the provider.";
      } else {
        document.getElementById("providerModelSource").textContent = result.message + " Presets remain available.";
      }
    });
    document.getElementById("closeProviderModal").addEventListener("click", closeProviderModal);
    document.getElementById("cancelProvider").addEventListener("click", closeProviderModal);
    document.getElementById("testProviderModal").addEventListener("click", async () => {
      if (!desktopBridge?.testProvider) { notify("Preview mode: testing requires the desktop runtime"); return; }
      await desktopBridge.testProvider({ type: document.getElementById("providerType").value, baseUrl: document.getElementById("providerEndpoint").value, model: selectedDesktopModel(), apiKey: document.getElementById("providerKey").value });
      notify("Provider endpoint is reachable");
    });
    document.getElementById("providerForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!desktopBridge?.saveProvider) { notify("Preview mode: secure vault bridge is not connected"); return; }
      const providerName = document.getElementById("providerType").value;
      const modelName = selectedDesktopModel();
      await desktopBridge.saveProvider({ type: providerName, baseUrl: document.getElementById("providerEndpoint").value, model: modelName, apiKey: document.getElementById("providerKey").value });
      updateDesktopActiveModelLabels(providerName, modelName);
      document.getElementById("providerKey").value = "";
      closeProviderModal();
      notify("Provider saved to the local vault");
    });
    providerModal.addEventListener("click", (event) => { if (event.target === providerModal) closeProviderModal(); });
    document.getElementById("closeAuthModal").addEventListener("click", closeAuthModal);
    authModal.addEventListener("click", (event) => { if (event.target === authModal) closeAuthModal(); });
    document.querySelectorAll(".auth-mode-tab").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
    document.getElementById("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value;
      if (!email || !password) {
        notify("Email and password are required");
        return;
      }
      await submitDesktopAuth(authMode === "signin" ? "signIn" : "signUp", { email, password });
    });
    document.getElementById("authGithub").addEventListener("click", async () => {
      await submitDesktopAuth(authMode === "signin" ? "signIn" : "signUp", { oauthProvider: "github" });
    });
    document.getElementById("authGoogle").addEventListener("click", async () => {
      await submitDesktopAuth(authMode === "signin" ? "signIn" : "signUp", { oauthProvider: "google" });
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        commandPalette.hidden ? openCommandPalette() : closeCommandPalette();
      }
      if (event.key === "Escape") {
        closeProviderModal();
        closeAuthModal();
        closeCommandPalette();
      }
    });
    document.getElementById("manageRoles").addEventListener("click", () => { setView("settings"); document.getElementById("modelRoles").scrollIntoView({ behavior: "smooth" }); });
    document.getElementById("approveApproval").addEventListener("click", () => {
      document.getElementById("approvalCard").style.display = "none";
      notify("Command approved for this run");
    });
    document.getElementById("denyApproval").addEventListener("click", () => {
      document.getElementById("approvalCard").style.opacity = "0.45";
      notify("Command denied");
    });
    document.getElementById("approveChatCommand").addEventListener("click", () => {
      const row = document.getElementById("chatCommandApproval");
      row.classList.remove("waiting");
      row.classList.add("completed");
      row.querySelector(".activity-row-actions").innerHTML = '<span class="task-state complete">Approved</span>';
      notify("Command approved for this run");
    });
    document.getElementById("denyChatCommand").addEventListener("click", () => {
      const row = document.getElementById("chatCommandApproval");
      row.style.opacity = "0.5";
      row.querySelector(".activity-row-actions").innerHTML = '<span class="task-state danger">Denied</span>';
      notify("Command denied");
    });
    document.querySelectorAll(".mode-tab").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    }));
    document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const filter = button.textContent.trim();
      document.querySelectorAll('[data-panel="agents"] .task-row').forEach((row) => {
        const state = row.querySelector(".task-state").textContent;
        row.hidden = filter !== "All runs" && !((filter === "Running" && state === "Running") || (filter === "Needs approval" && state === "Approval") || (filter === "Completed" && state === "Complete"));
      });
    }));
    document.querySelectorAll(".toggle").forEach((button) => button.addEventListener("click", () => {
      const enabled = button.classList.toggle("on");
      button.setAttribute("aria-checked", String(enabled));
    }));
    document.getElementById("saveSettings").addEventListener("click", async () => {
      if (!desktopBridge?.saveSettings) { notify("Preview mode: settings bridge is not connected"); return; }
      const toggles = document.querySelectorAll('[data-panel="settings"] .toggle');
      saveActiveModelBudget();
      await desktopBridge.saveSettings({ approvalMode: "manual", autoApply: toggles[0].classList.contains("on"), autoRunCommands: toggles[1].classList.contains("on"), persistHistory: toggles[3].classList.contains("on"), modelLimits: savedModelLimits });
      notify("Settings saved locally");
    });
    document.getElementById("newTask").addEventListener("click", () => { setView("chat"); document.querySelector('.mode-tab:nth-child(3)').click(); document.getElementById("chatPrompt").focus(); });
    document.getElementById("newThread").addEventListener("click", () => { document.getElementById("messageList").innerHTML = ""; document.getElementById("chatPrompt").focus(); notify("New thread ready"); });
    document.getElementById("clearThread").addEventListener("click", () => { document.getElementById("messageList").innerHTML = ""; notify("Thread cleared"); });
    document.querySelectorAll(".create-thread").forEach((button) => button.addEventListener("click", () => document.getElementById("newThread").click()));
    const threadConversations = {
      auth: ["Review the authentication callback flow and identify why sessions sometimes disappear after redirect.", "I traced the callback route, session helper, and middleware. The redirect currently happens before the refreshed session cookie is committed in one server path. I am comparing the affected branches now and will propose a small reviewable patch."],
      indexer: ["Profile workspace indexing and find the largest avoidable cost.", "The main cost is repeated parsing of unchanged files. I found a narrow cache boundary around content hashes that preserves ignore rules and symbol extraction."],
      routing: ["Set up provider routing for chat, edits, reasoning, and private local work.", "The role map is configured with explicit capability checks. Local-private requests stay on Ollama, while unavailable role models fall back only after a visible routing event."],
      release: ["Prepare the release checklist for the desktop app and extension.", "The checklist covers compile, extension packaging, provider smoke tests, approval gates, responsive chat layouts, and screenshot evidence for both surfaces."]
    };
    function openDesktopThread(button) {
      document.querySelectorAll(".thread-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const conversation = threadConversations[button.dataset.thread] || threadConversations.auth;
      document.getElementById("messageList").innerHTML = '<article class="message user"><span class="message-avatar user" aria-hidden="true">U</span><span class="message-label">You</span><div class="message-body"></div></article><article class="message"><span class="message-avatar assistant" aria-hidden="true">AI</span><span class="message-label">Assistant</span><div class="message-body"></div></article>';
      const bodies = document.querySelectorAll("#messageList .message-body");
      bodies[0].textContent = conversation[0];
      bodies[1].textContent = conversation[1];
      notify("Opened " + button.querySelector("strong").textContent);
    }
    document.querySelectorAll(".thread-button").forEach((button) => button.addEventListener("click", () => openDesktopThread(button)));
    document.getElementById("desktopThreadSearch").addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll(".thread-button").forEach((button) => button.hidden = Boolean(query) && !button.textContent.toLowerCase().includes(query));
    });
    document.querySelectorAll(".settings-link").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".settings-link").forEach((item) => item.classList.remove("active")); button.classList.add("active"); notify(button.textContent + " settings selected"); }));
    document.querySelectorAll(".view-all-runs").forEach((button) => button.addEventListener("click", () => setView("agents")));
    document.querySelectorAll(".more-button").forEach((button) => button.addEventListener("click", () => notify(button.dataset.providerName + " actions opened")));
    document.getElementById("desktopProfileButton").addEventListener("click", () => {
      setView("settings");
      document.getElementById("accountAccess").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("desktopSignIn").addEventListener("click", () => openAuthModal("signin"));
    document.getElementById("desktopSignUp").addEventListener("click", () => openAuthModal("signup"));
    document.getElementById("desktopSignOut").addEventListener("click", async () => {
      if (!desktopBridge?.signOut) { notify("Desktop authentication requires the Electron runtime"); return; }
      try {
        await desktopBridge.signOut();
        await refreshDesktopAuthStatus();
        notify("Signed out of Magnexis");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not sign out");
      }
    });
    document.getElementById("desktopRefreshSession").addEventListener("click", async () => {
      if (!desktopBridge?.refreshAuthSession) { notify("Desktop authentication requires the Electron runtime"); return; }
      try {
        updateDesktopAuthUi(await desktopBridge.refreshAuthSession());
        notify("Session refreshed");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not refresh the session");
      }
    });
    document.getElementById("desktopProtectedAction").addEventListener("click", async () => {
      if (!desktopBridge?.runProtectedAction) { notify("Desktop authentication requires the Electron runtime"); return; }
      try {
        const result = await desktopBridge.runProtectedAction();
        if (!result.ok) {
          setView("settings");
          openAuthModal("signin");
        }
        notify(result.message);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Protected action failed");
      }
    });
    document.getElementById("openRun").addEventListener("click", () => setView("agents"));
    document.getElementById("stopRun").addEventListener("click", () => notify("Stopping a run requires confirmation"));
    document.getElementById("reviewApprovals").addEventListener("click", () => setView("agents"));
    document.getElementById("exportToolManifest").addEventListener("click", () => {
      const tools = Array.from(document.querySelectorAll(".tool-card")).map((card) => ({
        id: card.dataset.tool,
        category: card.dataset.category,
        approvalRequired: Boolean(card.querySelector(".tool-approval.gated"))
      }));
      const payload = JSON.stringify({ exportedAt: new Date().toISOString(), tools }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "magnexis-tool-manifest.json";
      link.click();
      URL.revokeObjectURL(url);
      notify("Tool manifest exported");
    });
    document.getElementById("addToolManifest").addEventListener("click", () => {
      const panel = document.getElementById("toolRegisterPanel");
      panel.hidden = !panel.hidden;
      if (!panel.hidden) document.getElementById("toolManifestName").focus();
    });
    function bindToolRegistryButton(button) {
      button.addEventListener("click", async () => {
        const card = button.closest(".tool-card");
        const installed = card.dataset.installed === "true";
        card.dataset.installed = String(!installed);
        button.textContent = installed ? "Register" : "Enabled";
        button.classList.toggle("primary", installed);
        button.classList.toggle("quiet", !installed);
        if (desktopBridge?.setToolState) await desktopBridge.setToolState({ id: card.dataset.tool, enabled: !installed, source: card.dataset.category });
        notify(installed ? "Tool disabled" : "Tool registered; execution still requires approval");
      });
    }
    document.querySelectorAll(".tool-install, .tool-toggle").forEach(bindToolRegistryButton);
    if (desktopBridge?.listToolStates) desktopBridge.listToolStates().then((states) => {
      Object.entries(states).forEach(([id, state]) => {
        const card = document.querySelector('[data-tool="' + CSS.escape(id) + '"]');
        if (!card || typeof state.enabled !== "boolean") return;
        card.dataset.installed = String(state.enabled);
        const button = card.querySelector(".tool-install, .tool-toggle");
        if (button) { button.textContent = state.enabled ? "Enabled" : "Register"; button.classList.toggle("primary", !state.enabled); button.classList.toggle("quiet", state.enabled); }
      });
    });
    document.getElementById("toolRegisterPanel").addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = document.getElementById("toolManifestName").value.trim();
      const command = document.getElementById("toolManifestCommand").value.trim();
      if (!name || !command) { notify("Tool name and package or MCP URL are required"); return; }
      const card = document.createElement("article");
      card.className = "tool-card";
      card.dataset.tool = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      card.dataset.category = "metadata";
      card.dataset.installed = "true";
      card.innerHTML = '<div class="tool-heading"><div class="tool-mark medium">C</div><div class="tool-name"><strong></strong><span></span></div><span class="task-state risk medium">medium risk</span></div><p class="tool-description">Custom tool manifest registered locally. Execution remains approval-gated.</p><div class="tool-footer"><span class="tool-approval gated">Approval required before running</span><div class="tool-registry-actions"><span></span><button class="button quiet tool-toggle" type="button">Enabled</button></div></div>';
      card.querySelector(".tool-name strong").textContent = name;
      card.querySelector(".tool-name span").textContent = card.dataset.tool;
      card.querySelector(".tool-registry-actions span").textContent = command;
      document.getElementById("toolGrid").prepend(card);
      bindToolRegistryButton(card.querySelector(".tool-toggle"));
      if (desktopBridge?.registerTool) await desktopBridge.registerTool({ id: card.dataset.tool, name, command });
      event.target.reset();
      event.target.hidden = true;
      notify("Custom tool registered with approval required");
    });
    document.getElementById("toggleApprovalTools").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const gating = button.dataset.gated === "true";
      button.dataset.gated = String(!gating);
      button.textContent = gating ? "Show approval-gated only" : "Show all tools";
      document.querySelectorAll("#toolGrid .tool-card").forEach((card) => {
        card.hidden = gating ? false : !card.querySelector(".tool-approval.gated");
      });
    });
    document.getElementById("exportLogs").addEventListener("click", () => {
      const payload = JSON.stringify({ exportedAt: new Date().toISOString(), runs: [{ id: "auth-callback", status: "running" }, { id: "billing-tests", status: "approval" }] }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "magnexis-agent-runs.json";
      link.click();
      URL.revokeObjectURL(url);
      notify("Run logs exported");
    });
    document.getElementById("chatComposer").addEventListener("submit", (event) => {
      event.preventDefault();
      const prompt = document.getElementById("chatPrompt");
      const value = prompt.value.trim();
      if (!value) return;
      const message = document.createElement("article");
      message.className = "message user";
      const label = document.createElement("span");
      label.className = "message-label";
      label.textContent = "You";
      const body = document.createElement("div");
      body.className = "message-body";
      body.textContent = value;
      message.append(label, body);
      document.getElementById("messageList").append(message);
      prompt.value = "";
      message.scrollIntoView({ behavior: "smooth", block: "end" });
      streamDesktopAssistantReply(value);
      notify("Task sent to Z.ai / GLM-5.1");
    });
    document.querySelectorAll("[data-chat-context]").forEach((button) => button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      if (!desktopContextMenu.hidden && desktopContextMenu.dataset.anchor === target.dataset.chatContext) {
        closeDesktopContextMenu();
        return;
      }
      openDesktopContextMenu(target.dataset.chatContext, target);
    }));
    desktopContextMenu.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-context-choice]");
      if (!choice) return;
      notify(choice.dataset.contextChoice.replace(":", " · "));
      closeDesktopContextMenu();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".context-chips")) {
        closeDesktopContextMenu();
      }
    });
    const initialView = window.location.hash.slice(1);
    updateDesktopActiveModelLabels("Z.ai", "${escapeHtml(defaultModel)}");
    setView(viewCopy[initialView] ? initialView : "chat");
    refreshDesktopAuthStatus();
    document.querySelectorAll(".window-control").forEach((button) => button.addEventListener("click", async () => {
      const action = button.getAttribute("aria-label").toLowerCase();
      if (desktopBridge?.windowAction) await desktopBridge.windowAction(action);
      else notify(button.getAttribute("aria-label") + " is handled by the desktop runtime");
    }));
  </script>
</body>
</html>`;
}

function buildProviderCards(): LLMProviderCard[] {
  return providerPresets.map((provider, index) => ({
    id: provider.id,
    name: provider.name,
    monogram: provider.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase(),
    iconId: provider.iconId ?? provider.id,
    baseUrl: provider.baseUrl ?? "",
    description: provider.description ?? "External model provider",
    type: provider.isLocal ? "Local" : "Cloud",
    status: provider.id === "zai" ? "Connected" : provider.isLocal ? "Available" : "Needs key",
    models: provider.models ?? [],
    accent: index % 3 === 0 ? "amber" : index % 3 === 1 ? "blue" : "green"
  }));
}

function formatTokens(value?: number): string {
  if (!value) return "live";
  if (value >= 1000000) return `${Number((value / 1000000).toFixed(2))}M`;
  return `${Math.round(value / 1024)}K`;
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
