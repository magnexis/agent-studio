import * as fs from "node:fs";
import * as path from "node:path";
import { desktopViews } from "../../desktop/src/views.ts";
import { defaultMagnexisConfig } from "../../../packages/config/src/index.ts";
import { installableToolCatalog, toolCatalog } from "../../../packages/tools/src/index.ts";
import { listVerifiedModels, providerPresets } from "../../../packages/llm-router/src/index.ts";
import type { UpdateManifest, UpdateSourceConfig } from "../../../packages/types/src/index";
import { magnexisInteractiveComponentsCss, magnexisInteractiveTokensCss } from "../../../packages/ui/src/index";

export interface DashboardRailItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  active?: boolean;
}

export interface DashboardGuide {
  id: string;
  title: string;
  source: string;
  summary: string;
  bullets: string[];
  commands?: string[];
}

export interface DashboardShot {
  id: string;
  title: string;
  url: string;
}

export interface DashboardStat {
  value: string;
  label: string;
  detail: string;
}

export interface DashboardPage {
  title: string;
  version: string;
  tagline: string;
  rail: DashboardRailItem[];
  stats: DashboardStat[];
  guides: DashboardGuide[];
  screenshots: DashboardShot[];
  workflowTemplates: string[];
  configLayers: string[];
  routingRoles: string[];
  providerHighlights: string[];
  surfaceHighlights: string[];
  docsMap: string[];
  launchCommands: string[];
  safetyNotes: string[];
}

export function createDashboardPage(workspaceRoot: string = process.cwd()): DashboardPage {
  const repoRoot = resolveRepoRoot(workspaceRoot);
  const screenshots = readScreenshots(repoRoot);
  const guides = buildGuides(repoRoot);
  const version = readPackageVersion(repoRoot);
  const verifiedModels = listVerifiedModels();
  const localProviders = providerPresets.filter((provider) => provider.isLocal);
  const cloudProviders = providerPresets.filter((provider) => !provider.isLocal);
  const docsMap = [
    ...extractHeadings(readText(path.join(repoRoot, "README.md"))),
    ...extractHeadings(readText(path.join(repoRoot, "docs/ARCHITECTURE.md"))),
    ...extractHeadings(readText(path.join(repoRoot, "docs/DEVELOPMENT.md"))),
    ...extractHeadings(readText(path.join(repoRoot, "docs/PROVIDERS.md"))),
    ...extractHeadings(readText(path.join(repoRoot, "docs/SECURITY.md")))
  ];

  return {
    title: "Magnexis Agent Studio",
    version,
    tagline: "A local-first coding agent workbench spanning desktop, extension, CLI, and shared runtime contracts.",
    rail: [
      { id: "workspace", icon: "W", title: "Workspace", detail: "Focused agent workspace.", active: true },
      { id: "providers", icon: "P", title: "Providers", detail: "Routing, models, and keys." },
      { id: "tools", icon: "T", title: "Tools", detail: "Repo-aware actions and workflows." },
      { id: "docs", icon: "D", title: "Docs", detail: "Project references and runbooks." },
      { id: "safety", icon: "S", title: "Safety", detail: "Approvals, guards, and trust." },
      { id: "settings", icon: "C", title: "Settings", detail: "Workspace defaults and config." }
    ],
    stats: [
      { value: `${providerPresets.length}`, label: "Provider presets", detail: `${cloudProviders.length} cloud and ${localProviders.length} local routes in the shared catalog.` },
      { value: `${verifiedModels.length}`, label: "Pinned models", detail: "Verified model metadata is recorded with source URLs and verification dates." },
      { value: `${toolCatalog.length + installableToolCatalog.length}`, label: "Tool descriptors", detail: "Built-in and installable tools stay approval-aware across surfaces." },
      { value: `${screenshots.length}`, label: "Project screenshots", detail: "Real images from the current repo are embedded into the dashboard." }
    ],
    guides,
    screenshots,
    workflowTemplates: [
      "Review this PR",
      "Generate tests",
      "Refactor React component",
      "Find security issues",
      "Prepare production checklist",
      "Add API route"
    ],
    configLayers: [
      "~/.magnexis/config.json",
      "<workspace>/.magnexis/config.json",
      ".env for Supabase auth and callback settings"
    ],
    routingRoles: [
      "chat -> openai/gpt-4.1",
      "fastEdit -> mistral/devstral",
      "reasoning -> openai/o3",
      "largeContext -> gemini/gemini-1.5-pro",
      "localPrivate -> ollama/qwen2.5-coder",
      "embeddings -> openai/text-embedding-3-large"
    ],
    providerHighlights: providerPresets.slice(0, 8).map((provider) => {
      const modelCount = provider.models?.length ?? 0;
      return `${provider.name} - ${provider.isLocal ? "Local" : "Cloud"} - ${modelCount} model${modelCount === 1 ? "" : "s"}`;
    }),
    surfaceHighlights: desktopViews
      .filter((view) => ["workspace", "providers", "agents", "tools", "stats", "settings"].includes(view.id))
      .map((view) => `${view.title}: ${view.description}`),
    docsMap: docsMap.slice(0, 18),
    launchCommands: [
      "npm install",
      "npm run compile",
      "npm run desktop",
      "npm run preview:desktop",
      "npm run preview:extension",
      "npm run cli -- doctor --workspace ."
    ],
    safetyNotes: [
      "Manual approval is the default for file writes, commands, browser sessions, and custom tool registration.",
      "Provider keys stay out of run logs, config files, and source control.",
      "Supabase auth uses browser-based OAuth with a temporary localhost callback and state validation.",
      "High-risk paths such as .env, package manifests, auth, billing, and workflow files require explicit confirmation.",
      `Auto-apply default: ${defaultMagnexisConfig.autoApply ? "on" : "off"}.`
    ]
  };
}

export function renderDashboardPage(workspaceRoot: string = process.cwd()): string {
  const page = createDashboardPage(workspaceRoot);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.title)}</title>
  <style>
    ${renderDashboardStyles()}
  </style>
</head>
<body>
  <main class="workspace-shell">
    ${renderSidebar(page)}
    <section class="workspace-stage">
      ${renderWorkspace(page)}
      ${renderInspector(page)}
    </section>
  </main>
  <script>
    ${renderDropdownScript()}
  </script>
</body>
</html>`;
}

function renderSidebar(page: DashboardPage): string {
  const statusRows = [
    ["Local runtime", "Ready"],
    ["Approval mode", humanizeApprovalMode(defaultMagnexisConfig.approvalMode)],
    ["Auto-apply", defaultMagnexisConfig.autoApply ? "On" : "Off"]
  ].map(([label, value]) => `
    <div class="status-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");

  const nav = page.rail.map((item) => `
    <button class="nav-item${item.active ? " active" : ""}" type="button" aria-current="${item.active ? "page" : "false"}">
      <span class="nav-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
      <span class="nav-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </span>
    </button>
  `).join("");

  return `
    <aside class="workspace-sidebar">
      <section class="sidebar-brand">
        <div class="window-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="brand-mark"><img src="/media/magnexis-mark.svg" alt="Magnexis Agent Studio logo"></div>
        <div>
          <h1>${escapeHtml(page.title)}</h1>
          <p>Local-first coding agent workbench</p>
        </div>
      </section>

      <nav class="sidebar-nav" aria-label="Primary">
        ${nav}
      </nav>

      <section class="sidebar-status">
        <p class="section-label">Workspace status</p>
        ${statusRows}
      </section>

      <footer class="sidebar-footer">
        <span class="version-chip">v${escapeHtml(page.version)}</span>
      </footer>
    </aside>
  `;
}

function renderWorkspace(page: DashboardPage): string {
  const verifiedModels = listVerifiedModels();
  const providerOptions = buildProviderOptions();
  const modelOptions = buildModelOptions(verifiedModels);
  const modeOptions: DropdownOption[] = ["Chat", "Agent", "Review", "Debug", "Refactor"].map((mode) => ({
    label: mode,
    value: mode.toLowerCase()
  }));
  const recentTemplates = page.workflowTemplates.slice(0, 4).map((item) => `
    <button class="template-chip" type="button">${escapeHtml(item)}</button>
  `).join("");
  const contextChips = ["Docs", "Workspace", "Screenshots", "Config"].map((item) => `
    <button class="context-chip" type="button">${escapeHtml(item)}</button>
  `).join("");
  const transcript = [
    {
      role: "user",
      label: "You",
      body: "Find bugs in the dashboard layout, improve the provider picker, and make the web workspace feel tighter."
    },
    {
      role: "assistant",
      label: "Magnexis",
      body: "I can inspect the current UI, use the shared provider catalog, and propose a focused cleanup plan before applying interface changes."
    }
  ].map((entry) => `
    <article class="chat-bubble ${escapeHtml(entry.role)}">
      <span class="chat-bubble-label">${escapeHtml(entry.label)}</span>
      <p>${escapeHtml(entry.body)}</p>
    </article>
  `).join("");
  const alerts = buildMockUpdateManifests(page.version).map((manifest) => renderAlertBar(manifest)).join("");
  const launchButtons = [
    { label: "Open Docs", className: "ghost-button", href: "#docs" },
    { label: "Launch Desktop", className: "primary-button", href: "#desktop" },
    { label: "Open Extension", className: "ghost-button", href: "/workspaces/runtime/previews/magnexis-vscode-sidebar.html" },
    { label: "CLI Path", className: "ghost-button", href: "#cli-path" }
  ].map((action) => `
    <a class="${escapeHtml(action.className)} action-link" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>
  `).join("");

  return `
    <section class="workspace-main">
      <section class="alert-stack" aria-label="Update notifications">
        ${alerts}
      </section>
      <header class="workspace-header">
        <div>
          <p class="section-label">Agent workspace</p>
          <h2>Plan, edit, review, and run coding tasks from one focused surface.</h2>
          <p class="workspace-subtitle">Use the shared runtime, choose a route, attach repo context, and hand the next task to the agent.</p>
        </div>
        <div class="header-actions">${launchButtons}</div>
      </header>

      <section class="composer-card">
        <div class="composer-topbar">
          <div class="composer-selectors">
            ${renderCustomDropdown("provider", "Provider", providerOptions.selectedOption, providerOptions.options)}
            ${renderCustomDropdown("model", "Model", modelOptions.selectedOption, modelOptions.options)}
            ${renderCustomDropdown("mode", "Mode", modeOptions.find((option) => option.value === "agent") ?? modeOptions[0]!, modeOptions)}
          </div>
          <div class="composer-status">
            <span class="approval-pill">Manual approval</span>
          </div>
        </div>

        <label class="sr-only" for="agentPrompt">Coding task</label>
        <textarea
          id="agentPrompt"
          class="composer-input"
          aria-label="Message Magnexis workspace"
          rows="7"
          placeholder="Ask Magnexis to review this repo...&#10;Refactor the provider settings UI...&#10;Find bugs in the dashboard layout..."
        ></textarea>

        <div class="composer-toolbar">
          <div class="composer-toolbar-left">
            ${contextChips}
          </div>
          <div class="composer-toolbar-right">
            <button class="toolbar-icon" type="button" aria-label="Attach context">+</button>
            <button class="toolbar-icon" type="button" aria-label="Choose files">@</button>
            <button class="primary-button run-button" type="button" aria-label="Run task"><span aria-hidden="true">&#8593;</span></button>
          </div>
        </div>
      </section>

      <section class="workspace-support">
        <div class="template-row">
          <div class="template-copy">
            <p class="section-label">Recent prompts</p>
            <h3>Start from a useful workflow</h3>
          </div>
          <div class="template-chip-row">${recentTemplates}</div>
        </div>
      </section>

      <section class="activity-card">
        <div class="activity-header">
          <div>
            <p class="section-label">Agent activity</p>
            <h3>Run preview</h3>
          </div>
          <span class="activity-route">Route: provider default</span>
        </div>
        <div class="activity-layout">
          <div class="chat-thread" aria-label="Recent agent messages">
            ${transcript}
          </div>
          <aside class="activity-sidebar">
            <div class="activity-mini-card">
              <strong>Workspace context</strong>
              <ul>
                <li>Docs attached</li>
                <li>Workspace summary available</li>
                <li>Screenshots discovered</li>
                <li>Config loaded</li>
              </ul>
            </div>
            <div class="activity-mini-card empty">
              <strong>No active run yet</strong>
              <p>Start by describing a task for the agent. Results, approvals, and diff previews will appear here.</p>
            </div>
          </aside>
        </div>
      </section>
    </section>
  `;
}

function renderInspector(page: DashboardPage): string {
  const verifiedModels = listVerifiedModels();
  const localProviders = providerPresets.filter((provider) => provider.isLocal).length;
  const cloudProviders = providerPresets.length - localProviders;
  const updateSourceConfig = buildUpdateSourceConfig();
  const desktopManifest = buildMockUpdateManifests(page.version).find((item) => item.packageType === "desktop");
  const screenshots = page.screenshots.slice(0, 2);
  const docsList = page.docsMap.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const routes = page.routingRoles.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const safety = page.safetyNotes.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const launchPaths = [
    { label: "VS Code extension", value: "npm run preview:extension" },
    { label: "CLI doctor", value: "npm run cli -- doctor --workspace ." },
    { label: "CLI status", value: "npm run cli -- status" }
  ].map((item) => `
    <div class="path-row">
      <span>${escapeHtml(item.label)}</span>
      <code>${escapeHtml(item.value)}</code>
    </div>
  `).join("");
  const screenshotMarkup = screenshots.length
    ? screenshots.map((shot) => `
      <figure class="evidence-shot">
        <img src="${escapeHtml(shot.url)}" alt="${escapeHtml(shot.title)}">
        <figcaption>${escapeHtml(shot.title)}</figcaption>
      </figure>
    `).join("")
    : `<div class="empty-evidence">No captured screenshots yet.</div>`;

  return `
    <aside class="workspace-inspector">
      <section class="inspector-card">
        <p class="section-label">Active route</p>
        <h3>Model routing</h3>
        <ul>${routes}</ul>
      </section>

      <section class="inspector-card">
        <p class="section-label">Provider summary</p>
        <h3>Catalog state</h3>
        <div class="summary-grid">
          <div class="summary-tile"><strong>${providerPresets.length}</strong><span>Presets</span></div>
          <div class="summary-tile"><strong>${verifiedModels.length}</strong><span>Models</span></div>
          <div class="summary-tile"><strong>${cloudProviders}</strong><span>Cloud</span></div>
          <div class="summary-tile"><strong>${localProviders}</strong><span>Local</span></div>
        </div>
        <div class="provider-logo-row">
          ${providerPresets.slice(0, 8).map((provider) => `
            <div class="provider-logo-chip" title="${escapeHtml(provider.name)}">
              <img src="${escapeHtml(providerLogoPath(provider.id))}" alt="${escapeHtml(provider.name)} logo">
              <span>${escapeHtml(provider.name)}</span>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="inspector-card">
        <p class="section-label">Safety</p>
        <h3>Approval and trust</h3>
        <ul>${safety}</ul>
      </section>

      <section class="inspector-card">
        <p class="section-label">Surfaces</p>
        <h3 id="cli-path">Extension and CLI</h3>
        <div class="path-list">${launchPaths}</div>
      </section>

      ${desktopManifest ? renderDesktopPreflight(desktopManifest) : ""}

      <section class="inspector-card">
        <p class="section-label">Docs</p>
        <h3>Reference map</h3>
        <ul>${docsList}</ul>
      </section>

      <section class="inspector-card">
        <p class="section-label">Evidence</p>
        <h3>Repo screenshots</h3>
        <div class="evidence-grid">${screenshotMarkup}</div>
      </section>

      ${renderUpdateSettings(updateSourceConfig)}
    </aside>
  `;
}

function renderAlertBar(manifest: UpdateManifest): string {
  const linkHref = manifest.releaseNotesUrl || manifest.downloadUrl || "#update-settings";
  const linkLabel = manifest.packageType === "desktop"
    ? "Release notes"
    : manifest.packageType === "vscode-extension"
      ? "View update settings"
      : "Open settings";

  return `
    <section
      class="alert-bar ${escapeHtml(manifest.severity)}"
      role="status"
      aria-live="${manifest.isCritical ? "assertive" : "polite"}"
      data-alert-id="${escapeHtml(`${manifest.packageType}:${manifest.latestVersion}:${manifest.severity}`)}"
    >
      <div class="alert-copy">
        <span class="alert-kicker">${escapeHtml(alertLabelForSeverity(manifest.severity))}</span>
        <p>${escapeHtml(manifest.message)}</p>
      </div>
      <div class="alert-actions">
        <a class="alert-link" href="${escapeHtml(linkHref)}">${escapeHtml(linkLabel)}</a>
        <button class="alert-dismiss" type="button" aria-label="Dismiss update alert" data-alert-dismiss>&times;</button>
      </div>
    </section>
  `;
}

function renderDesktopPreflight(manifest: UpdateManifest): string {
  const warnings: string[] = [];
  if (!manifest.checksum) warnings.push("Checksum metadata is missing for the selected desktop package.");
  if (!manifest.currentVersion || !manifest.latestVersion) warnings.push("Version metadata is incomplete.");
  if (manifest.currentVersion !== manifest.latestVersion) warnings.push(`A newer desktop version (${manifest.latestVersion}) is available.`);

  return `
    <section class="inspector-card">
      <p class="section-label">Desktop package</p>
      <h3>Preflight check</h3>
      <div class="preflight-summary">
        <span>Installed: ${escapeHtml(manifest.currentVersion)}</span>
        <span>Latest: ${escapeHtml(manifest.latestVersion)}</span>
      </div>
      ${warnings.length
        ? `<div class="preflight-warning-bar${manifest.isCritical ? " critical" : ""}">
            ${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
          </div>`
        : `<div class="empty-evidence">Package metadata looks healthy for this build.</div>`}
    </section>
  `;
}

function renderUpdateSettings(config: UpdateSourceConfig): string {
  const rows = [
    ["GitHub Releases URL", config.githubReleasesUrl ?? "Set MAGNEXIS_GITHUB_RELEASES_URL"],
    ["VS Code Marketplace", config.vscodeMarketplaceUrl ?? "Set MAGNEXIS_VSCODE_MARKETPLACE_URL"],
    ["Desktop manifest", config.desktopManifestUrl ?? "Set MAGNEXIS_DESKTOP_MANIFEST_URL"],
    ["Internal manifest", config.internalManifestUrl ?? "Set MAGNEXIS_UPDATE_MANIFEST_URL"]
  ].map(([label, value]) => `
    <div class="path-row">
      <span>${escapeHtml(label)}</span>
      <code>${escapeHtml(value)}</code>
    </div>
  `).join("");

  return `
    <section class="inspector-card" id="update-settings">
      <p class="section-label">Updates</p>
      <h3>Update settings</h3>
      <div class="path-list">${rows}</div>
      <div class="settings-actions">
        <button class="ghost-button reset-alerts" type="button" data-reset-alerts>Reset dismissed alerts</button>
      </div>
    </section>
  `;
}

type DropdownOption = {
  label: string;
  value: string;
  iconUrl?: string;
};

function renderDropdownOptionContent(option: DropdownOption): string {
  const icon = option.iconUrl
    ? `<img class="dropdown-option-icon" src="${escapeHtml(option.iconUrl)}" alt="" aria-hidden="true">`
    : "";

  return `
    <span class="dropdown-option-copy">
      ${icon}
      <span class="dropdown-option-label">${escapeHtml(option.label)}</span>
    </span>
  `;
}

function renderSelectedDropdownValue(option: DropdownOption): string {
  const icon = option.iconUrl
    ? `<img class="dropdown-value-icon" src="${escapeHtml(option.iconUrl)}" alt="" aria-hidden="true">`
    : "";

  return `
    <span class="dropdown-value-copy">
      ${icon}
      <span class="dropdown-value-label">${escapeHtml(option.label)}</span>
    </span>
  `;
}

function renderCustomDropdown(id: string, label: string, selectedOption: DropdownOption, options: DropdownOption[]): string {
  const optionMarkup = options.map((option) => `
    <button
      class="dropdown-option${option.value === selectedOption.value ? " selected" : ""}"
      type="button"
      role="option"
      data-dropdown-option
      data-value="${escapeHtml(option.value)}"
      data-label="${escapeHtml(option.label)}"
      data-icon-url="${escapeHtml(option.iconUrl ?? "")}"
      aria-selected="${option.value === selectedOption.value ? "true" : "false"}"
    >
      ${renderDropdownOptionContent(option)}
    </button>
  `).join("");

  return `
    <div class="custom-dropdown" data-dropdown="${escapeHtml(id)}">
      <span class="sr-only" id="${escapeHtml(id)}Label">${escapeHtml(label)}</span>
      <button
        class="dropdown-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-labelledby="${escapeHtml(id)}Label ${escapeHtml(id)}Value"
        data-dropdown-trigger
      >
        <span class="dropdown-meta">${escapeHtml(label)}</span>
        <span class="dropdown-value" id="${escapeHtml(id)}Value" data-dropdown-value>${renderSelectedDropdownValue(selectedOption)}</span>
        <span class="dropdown-caret" aria-hidden="true">&#9662;</span>
      </button>
      <div class="dropdown-menu" role="listbox" aria-label="${escapeHtml(label)}" hidden data-dropdown-menu>
        ${optionMarkup}
      </div>
    </div>
  `;
}

function buildProviderOptions(): { selectedOption: DropdownOption; options: DropdownOption[] } {
  const options = providerPresets.map((provider) => ({
    label: provider.name,
    value: provider.id,
    iconUrl: providerLogoPath(provider.id)
  }));
  return {
    selectedOption: options.find((provider) => provider.value === "zai") ?? options[0] ?? { label: "Provider", value: "provider" },
    options
  };
}

function buildModelOptions(models: ReturnType<typeof listVerifiedModels>): { selectedOption: DropdownOption; options: DropdownOption[] } {
  const options = models
    .map((model) => ({
      label: `${providerNameForModel(model.providerId)} / ${model.displayName}`,
      value: model.id,
      iconUrl: providerLogoPath(model.providerId)
    }))
    .slice(0, 20);
  const defaultModel = models.find((model) => model.id === "glm-5.1");
  return {
    selectedOption: defaultModel
      ? {
          label: `${providerNameForModel(defaultModel.providerId)} / ${defaultModel.displayName}`,
          value: defaultModel.id,
          iconUrl: providerLogoPath(defaultModel.providerId)
        }
      : options[0] ?? { label: "Model", value: "model" },
    options
  };
}

function providerNameForModel(providerId: string): string {
  return providerPresets.find((provider) => provider.id === providerId)?.name ?? providerId;
}

function providerLogoPath(providerId: string): string {
  const assetId = providerId === "custom-openai-compatible" ? "custom" : providerId;
  return `/media/providers/${assetId}.png`;
}

function humanizeApprovalMode(mode: string): string {
  return mode
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function alertLabelForSeverity(severity: UpdateManifest["severity"]): string {
  switch (severity) {
    case "critical-update":
      return "Critical update";
    case "security-update":
      return "Security update";
    case "provider-update":
      return "Provider update";
    case "desktop-app-update":
      return "Desktop update";
    case "vscode-extension-update":
      return "Extension update";
    case "warning":
      return "Warning";
    default:
      return "Info";
  }
}

function buildMockUpdateManifests(currentVersion: string): UpdateManifest[] {
  return [
    {
      product: "magnexis-agent-studio",
      currentVersion,
      latestVersion: "0.3.1",
      minimumRequiredVersion: currentVersion,
      severity: "desktop-app-update",
      message: "A new desktop app update is available.",
      downloadUrl: "",
      releaseNotesUrl: "#update-settings",
      sourceUrl: process.env.MAGNEXIS_DESKTOP_MANIFEST_URL ?? "",
      publishedAt: "2026-06-28",
      packageType: "desktop",
      checksum: "",
      isCritical: false,
      updateNotes: ["Improved provider cards.", "Refined desktop theme.", "Minor runtime fixes."]
    },
    {
      product: "magnexis-agent-studio",
      currentVersion,
      latestVersion: "0.3.2",
      minimumRequiredVersion: currentVersion,
      severity: "vscode-extension-update",
      message: "A newer VS Code extension build is ready.",
      downloadUrl: "",
      releaseNotesUrl: "#update-settings",
      sourceUrl: process.env.MAGNEXIS_VSCODE_MARKETPLACE_URL ?? "",
      publishedAt: "2026-06-28",
      packageType: "vscode-extension",
      checksum: "preview-only",
      isCritical: false
    },
    {
      product: "magnexis-agent-studio",
      currentVersion,
      latestVersion: currentVersion,
      minimumRequiredVersion: currentVersion,
      severity: "provider-update",
      message: "Provider metadata was refreshed. Review routing before long-running jobs.",
      downloadUrl: "",
      releaseNotesUrl: "#update-settings",
      sourceUrl: process.env.MAGNEXIS_UPDATE_MANIFEST_URL ?? "",
      publishedAt: "2026-06-28",
      packageType: "platform",
      checksum: "n/a",
      isCritical: false
    }
  ];
}

function buildUpdateSourceConfig(): UpdateSourceConfig {
  return {
    githubReleasesUrl: process.env.MAGNEXIS_GITHUB_RELEASES_URL?.trim(),
    vscodeMarketplaceUrl: process.env.MAGNEXIS_VSCODE_MARKETPLACE_URL?.trim(),
    desktopManifestUrl: process.env.MAGNEXIS_DESKTOP_MANIFEST_URL?.trim(),
    internalManifestUrl: process.env.MAGNEXIS_UPDATE_MANIFEST_URL?.trim()
  };
}

function renderDashboardStyles(): string {
  return `
    :root {
      color-scheme: dark;
      --radius: 14px;
      --background: #080808;
      --panel: rgba(15, 15, 15, 0.96);
      --panel-strong: rgba(19, 19, 19, 0.98);
      --panel-soft: rgba(23, 23, 23, 0.98);
      --border: rgba(255, 255, 255, 0.10);
      --border-strong: rgba(255, 255, 255, 0.16);
      --text: #f4f4f5;
      --muted: #a3a3a3;
      --muted-strong: #c7c7c7;
      --primary: #dfdfdf;
      --primary-text: #090909;
      --shadow: 0 20px 48px rgba(0, 0, 0, 0.42);
      ${magnexisInteractiveTokensCss}
    }
    ${magnexisInteractiveComponentsCss}
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      font-family: Inter, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.05), transparent 20%),
        linear-gradient(180deg, #050505 0%, #090909 100%);
      color: var(--text);
    }
    button, textarea { font: inherit; }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .workspace-shell {
      width: min(1500px, calc(100% - 24px));
      min-height: calc(100vh - 24px);
      margin: 12px auto;
      padding: 12px;
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
      gap: 12px;
      border: 1px solid var(--border);
      border-radius: 24px;
      background: rgba(10, 10, 10, 0.94);
      box-shadow: var(--shadow);
    }
    .workspace-sidebar,
    .workspace-main,
    .workspace-inspector {
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--panel);
    }
    .workspace-sidebar {
      padding: 16px;
      display: grid;
      grid-template-rows: auto auto auto 1fr;
      gap: 16px;
    }
    .sidebar-brand {
      padding: 14px;
      display: grid;
      gap: 12px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
    }
    .window-dots { display: inline-flex; gap: 8px; }
    .window-dots span {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.10);
    }
    .brand-mark {
      width: 42px;
      height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
      overflow: hidden;
    }
    .brand-mark img {
      width: 26px;
      height: 26px;
      object-fit: contain;
    }
    .sidebar-brand h1 {
      margin: 0;
      font-size: 17px;
      line-height: 1.15;
    }
    .sidebar-brand p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .sidebar-nav {
      display: grid;
      gap: 8px;
    }
    .nav-item {
      width: 100%;
      padding: 12px;
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      border: 1px solid transparent;
      border-radius: 16px;
      background: transparent;
      color: var(--text);
      text-align: left;
    }
    .nav-item.active {
      border-color: var(--border-strong);
      background: rgba(255, 255, 255, 0.05);
    }
    .nav-icon {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.04);
      font-size: 12px;
      font-weight: 700;
    }
    .nav-copy { min-width: 0; display: grid; gap: 3px; }
    .nav-copy strong { font-size: 12px; }
    .nav-copy small { color: var(--muted); font-size: 11px; line-height: 1.4; }
    .sidebar-status {
      padding: 14px;
      display: grid;
      gap: 10px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.02);
      align-content: start;
    }
    .section-label {
      margin: 0;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      color: var(--muted-strong);
    }
    .status-row strong { color: var(--text); font-weight: 600; }
    .sidebar-footer {
      display: flex;
      justify-content: flex-start;
      align-self: end;
    }
    .version-chip {
      min-height: 30px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted-strong);
      font-size: 12px;
      background: rgba(255, 255, 255, 0.03);
    }
    .workspace-stage {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 12px;
    }
    .workspace-main {
      padding: 16px;
      display: grid;
      gap: 14px;
    }
    .alert-stack {
      display: grid;
      gap: 8px;
    }
    .alert-bar {
      min-height: 48px;
      padding: 10px 14px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
    }
    .alert-bar.info,
    .alert-bar.provider-update,
    .alert-bar.desktop-app-update,
    .alert-bar.vscode-extension-update {
      border-color: rgba(255, 255, 255, 0.12);
    }
    .alert-bar.warning {
      border-color: rgba(245, 158, 11, 0.36);
      background: rgba(245, 158, 11, 0.08);
    }
    .alert-bar.critical-update,
    .alert-bar.security-update {
      border-color: rgba(248, 113, 113, 0.38);
      background: rgba(248, 113, 113, 0.10);
    }
    .alert-copy {
      min-width: 0;
      display: grid;
      gap: 4px;
      flex: 1 1 320px;
    }
    .alert-kicker {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .alert-copy p {
      margin: 0;
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
    }
    .alert-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .alert-link {
      color: var(--text);
      font-size: 12px;
      text-decoration: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.18);
    }
    .alert-dismiss {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: transparent;
      color: var(--muted-strong);
      font-size: 14px;
    }
    .workspace-header {
      padding: 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--panel-strong);
    }
    .workspace-header h2 {
      margin: 4px 0 0;
      font-size: 24px;
      line-height: 1.2;
      max-width: 28ch;
    }
    .workspace-subtitle {
      margin: 8px 0 0;
      color: var(--muted);
      max-width: 62ch;
      line-height: 1.6;
      font-size: 13px;
    }
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ghost-button,
    .primary-button,
    .toolbar-icon,
    .template-chip,
    .context-chip {
      border: 1px solid var(--border);
      border-radius: 999px;
      transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
    }
    .ghost-button,
    .primary-button {
      min-height: 38px;
      padding: 0 14px;
      color: var(--text);
      background: rgba(255, 255, 255, 0.03);
      text-decoration: none;
    }
    .action-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .primary-button {
      background: var(--primary);
      color: var(--primary-text);
      border-color: rgba(255, 255, 255, 0.22);
      font-weight: 600;
    }
    .primary-button:hover,
    .ghost-button:hover,
    .toolbar-icon:hover,
    .template-chip:hover,
    .context-chip:hover,
    .dropdown-trigger:hover,
    .dropdown-option:hover {
      transform: translateY(-1px);
    }
    .composer-card,
    .workspace-support,
    .activity-card,
    .inspector-card {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--panel-strong);
    }
    .composer-card {
      padding: 16px;
      display: grid;
      gap: 14px;
    }
    .composer-topbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .composer-selectors {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .composer-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .approval-pill {
      min-height: 32px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: var(--muted-strong);
      background: rgba(255, 255, 255, 0.03);
      font-size: 12px;
    }
    .custom-dropdown {
      position: relative;
      min-width: 220px;
      max-width: 100%;
    }
    .dropdown-trigger {
      width: 100%;
      min-height: 54px;
      padding: 10px 14px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 10px;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.02);
      color: var(--text);
      text-align: left;
    }
    .dropdown-meta {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .dropdown-value {
      min-width: 0;
      font-size: 13px;
    }
    .dropdown-value-copy,
    .dropdown-option-copy {
      min-width: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .dropdown-value-label,
    .dropdown-option-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dropdown-value-icon,
    .dropdown-option-icon {
      width: 16px;
      height: 16px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .dropdown-caret { color: var(--muted); font-size: 11px; }
    .dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      z-index: 20;
      max-height: 280px;
      overflow: auto;
      padding: 8px;
      border: 1px solid var(--border-strong);
      border-radius: 16px;
      background: #101010;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
      display: grid;
      gap: 4px;
    }
    .dropdown-option {
      width: 100%;
      min-height: 38px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      border: 1px solid transparent;
      border-radius: 12px;
      background: transparent;
      color: var(--text);
      text-align: left;
    }
    .dropdown-option.selected {
      background: rgba(255, 255, 255, 0.07);
      border-color: var(--border);
    }
    .composer-input {
      width: 100%;
      min-height: 220px;
      padding: 18px 20px;
      resize: vertical;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.02);
      color: var(--text);
      line-height: 1.65;
      font-size: 14px;
    }
    .composer-input::placeholder { color: #8f8f8f; }
    .composer-toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .composer-toolbar-left,
    .composer-toolbar-right {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .context-chip,
    .template-chip {
      min-height: 32px;
      padding: 0 12px;
      color: var(--muted-strong);
      background: rgba(255, 255, 255, 0.02);
      font-size: 12px;
    }
    .toolbar-icon {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--text);
      background: rgba(255, 255, 255, 0.03);
      font-size: 15px;
    }
    .run-button {
      width: 38px;
      min-width: 38px;
      height: 38px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .workspace-support {
      padding: 14px 16px;
    }
    .template-row {
      display: grid;
      gap: 10px;
    }
    .template-copy h3 {
      margin: 6px 0 0;
      font-size: 15px;
    }
    .template-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .activity-card {
      padding: 16px;
      display: grid;
      gap: 14px;
    }
    .activity-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .activity-header h3 {
      margin: 6px 0 0;
      font-size: 16px;
    }
    .activity-route {
      color: var(--muted);
      font-size: 12px;
    }
    .activity-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 270px;
      gap: 12px;
    }
    .chat-thread {
      min-height: 280px;
      padding: 14px;
      display: grid;
      align-content: start;
      gap: 12px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.02);
    }
    .chat-bubble {
      max-width: 86%;
      padding: 14px 16px;
      display: grid;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.03);
    }
    .chat-bubble.user {
      margin-left: auto;
      background: rgba(255, 255, 255, 0.06);
    }
    .chat-bubble.assistant {
      margin-right: auto;
    }
    .chat-bubble-label {
      color: var(--muted);
      font-size: 11px;
    }
    .chat-bubble p {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
    }
    .activity-sidebar {
      display: grid;
      gap: 12px;
      align-content: start;
    }
    .activity-mini-card {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.02);
      display: grid;
      gap: 8px;
    }
    .activity-mini-card strong {
      font-size: 13px;
    }
    .activity-mini-card ul {
      margin: 0;
      padding-left: 18px;
    }
    .activity-mini-card li,
    .activity-mini-card p {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
      margin: 0;
    }
    .workspace-inspector {
      padding: 16px;
      display: grid;
      gap: 12px;
      align-content: start;
    }
    .inspector-card {
      padding: 14px;
      display: grid;
      gap: 10px;
    }
    .inspector-card h3 {
      margin: 0;
      font-size: 15px;
    }
    .inspector-card ul {
      margin: 0;
      padding-left: 18px;
    }
    .inspector-card li {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
      margin-bottom: 6px;
    }
    .path-list {
      display: grid;
      gap: 8px;
    }
    .path-row {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.02);
    }
    .path-row span {
      color: var(--muted-strong);
      font-size: 12px;
    }
    .path-row code {
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
      font-family: "Cascadia Code", Consolas, monospace;
      font-size: 11px;
      white-space: normal;
      word-break: break-word;
    }
    .settings-actions {
      display: flex;
      justify-content: flex-start;
    }
    .preflight-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted-strong);
      font-size: 12px;
    }
    .preflight-warning-bar {
      padding: 10px 12px;
      border: 1px solid rgba(245, 158, 11, 0.32);
      border-radius: 14px;
      background: rgba(245, 158, 11, 0.08);
      display: grid;
      gap: 6px;
    }
    .preflight-warning-bar.critical {
      border-color: rgba(248, 113, 113, 0.38);
      background: rgba(248, 113, 113, 0.12);
    }
    .preflight-warning-bar p {
      margin: 0;
      color: var(--text);
      font-size: 12px;
      line-height: 1.5;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .summary-tile {
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.02);
      display: grid;
      gap: 4px;
    }
    .summary-tile strong {
      font-size: 20px;
    }
    .summary-tile span {
      color: var(--muted);
      font-size: 11px;
    }
    .provider-logo-row {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .provider-logo-chip {
      min-height: 34px;
      padding: 6px 10px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.025);
      color: var(--muted-strong);
      font-size: 11px;
      line-height: 1;
    }
    .provider-logo-chip img {
      width: 16px;
      height: 16px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .evidence-grid {
      display: grid;
      gap: 10px;
    }
    .evidence-shot {
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .evidence-shot img {
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: #0d0d0d;
    }
    .evidence-shot figcaption,
    .empty-evidence {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.5;
    }
    .focus-ring:focus-visible,
    .nav-item:focus-visible,
    .ghost-button:focus-visible,
    .primary-button:focus-visible,
    .toolbar-icon:focus-visible,
    .template-chip:focus-visible,
    .context-chip:focus-visible,
    .dropdown-trigger:focus-visible,
    .dropdown-option:focus-visible,
    .composer-input:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.38);
      outline-offset: 2px;
    }
    @media (max-width: 1240px) {
      .workspace-stage {
        grid-template-columns: 1fr;
      }
      .workspace-inspector {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 980px) {
      .workspace-shell {
        grid-template-columns: 1fr;
      }
      .workspace-sidebar {
        grid-template-rows: auto auto auto;
      }
      .activity-layout {
        grid-template-columns: 1fr;
      }
      .workspace-inspector {
        grid-template-columns: 1fr;
      }
      .alert-bar {
        align-items: flex-start;
      }
    }
    @media (max-width: 720px) {
      .workspace-shell {
        width: min(100%, calc(100% - 12px));
        margin: 6px auto;
        min-height: calc(100vh - 12px);
        padding: 8px;
      }
      .workspace-main,
      .workspace-inspector,
      .workspace-sidebar {
        padding: 12px;
      }
      .custom-dropdown {
        min-width: 100%;
      }
      .composer-selectors {
        width: 100%;
      }
      .composer-input {
        min-height: 180px;
      }
      .summary-grid {
        grid-template-columns: 1fr 1fr;
      }
      .chat-bubble {
        max-width: 100%;
      }
      .nav-item {
        grid-template-columns: 28px minmax(0, 1fr);
      }
      .alert-actions {
        width: 100%;
        justify-content: space-between;
      }
    }
  `;
}

function renderDropdownScript(): string {
  return `
    (() => {
      const dismissalKey = "magnexis.updateDismissals";
      const dropdowns = Array.from(document.querySelectorAll("[data-dropdown]"));
      const alerts = Array.from(document.querySelectorAll("[data-alert-id]"));
      const resetAlertsButton = document.querySelector("[data-reset-alerts]");

      function loadDismissals() {
        try {
          return JSON.parse(localStorage.getItem(dismissalKey) || "[]");
        } catch {
          return [];
        }
      }

      function saveDismissals(dismissals) {
        localStorage.setItem(dismissalKey, JSON.stringify(dismissals));
      }

      function applyDismissals() {
        const dismissals = new Set(loadDismissals());
        alerts.forEach((alert) => {
          const id = alert.getAttribute("data-alert-id");
          alert.hidden = Boolean(id && dismissals.has(id));
        });
      }

      function closeDropdown(dropdown) {
        const trigger = dropdown.querySelector("[data-dropdown-trigger]");
        const menu = dropdown.querySelector("[data-dropdown-menu]");
        if (!trigger || !menu) return;
        trigger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      }

      function openDropdown(dropdown) {
        dropdowns.forEach((candidate) => {
          if (candidate !== dropdown) closeDropdown(candidate);
        });
        const trigger = dropdown.querySelector("[data-dropdown-trigger]");
        const menu = dropdown.querySelector("[data-dropdown-menu]");
        if (!trigger || !menu) return;
        trigger.setAttribute("aria-expanded", "true");
        menu.hidden = false;
      }

      dropdowns.forEach((dropdown) => {
        const trigger = dropdown.querySelector("[data-dropdown-trigger]");
        const menu = dropdown.querySelector("[data-dropdown-menu]");
        const value = dropdown.querySelector("[data-dropdown-value]");
        const options = Array.from(dropdown.querySelectorAll("[data-dropdown-option]"));
        if (!trigger || !menu || !value) return;

        trigger.addEventListener("click", () => {
          const expanded = trigger.getAttribute("aria-expanded") === "true";
          if (expanded) closeDropdown(dropdown);
          else openDropdown(dropdown);
        });

        options.forEach((option) => {
          option.addEventListener("click", () => {
            const label = option.getAttribute("data-label") || option.textContent || "";
            const iconUrl = option.getAttribute("data-icon-url") || "";
            value.innerHTML = iconUrl
              ? '<span class="dropdown-value-copy"><img class="dropdown-value-icon" src="' + iconUrl + '" alt="" aria-hidden="true"><span class="dropdown-value-label"></span></span>'
              : '<span class="dropdown-value-copy"><span class="dropdown-value-label"></span></span>';
            const labelNode = value.querySelector(".dropdown-value-label");
            if (labelNode) labelNode.textContent = label;
            options.forEach((candidate) => {
              candidate.classList.remove("selected");
              candidate.setAttribute("aria-selected", "false");
            });
            option.classList.add("selected");
            option.setAttribute("aria-selected", "true");
            closeDropdown(dropdown);
            trigger.focus();
          });
        });
      });

      document.addEventListener("click", (event) => {
        dropdowns.forEach((dropdown) => {
          if (!dropdown.contains(event.target)) closeDropdown(dropdown);
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          dropdowns.forEach((dropdown) => closeDropdown(dropdown));
        }
      });

      alerts.forEach((alert) => {
        const dismiss = alert.querySelector("[data-alert-dismiss]");
        dismiss?.addEventListener("click", () => {
          const id = alert.getAttribute("data-alert-id");
          if (!id) return;
          const dismissals = new Set(loadDismissals());
          dismissals.add(id);
          saveDismissals(Array.from(dismissals));
          alert.hidden = true;
        });
      });

      resetAlertsButton?.addEventListener("click", () => {
        localStorage.removeItem(dismissalKey);
        alerts.forEach((alert) => {
          alert.hidden = false;
        });
      });

      applyDismissals();
    })();
  `;
}

function resolveRepoRoot(workspaceRoot: string): string {
  const candidate = path.resolve(workspaceRoot);
  if (fs.existsSync(path.join(candidate, "package.json")) && fs.existsSync(path.join(candidate, "README.md"))) {
    return candidate;
  }
  return process.cwd();
}

function readScreenshots(repoRoot: string): DashboardShot[] {
  const directory = path.join(repoRoot, "screenshots");
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((fileName) => /\.(png|jpg|jpeg|webp)$/i.test(fileName))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((fileName) => ({
      id: fileName,
      title: humanizeAssetName(fileName),
      url: `/screenshots/${encodeURIComponent(fileName)}`
    }));
}

function buildGuides(repoRoot: string): DashboardGuide[] {
  const readmeHeadings = extractHeadings(readText(path.join(repoRoot, "README.md")));
  const developmentHeadings = extractHeadings(readText(path.join(repoRoot, "docs/DEVELOPMENT.md")));
  const providerHeadings = extractHeadings(readText(path.join(repoRoot, "docs/PROVIDERS.md")));
  const securityHeadings = extractHeadings(readText(path.join(repoRoot, "docs/SECURITY.md")));

  return [
    {
      id: "quick-start",
      title: "Quick start and local launch",
      source: "README.md",
      summary: "The current repo already documents the exact commands needed to install, compile, preview, package, and run the desktop and extension surfaces.",
      bullets: [
        "Requirements are Node.js 20+, npm, VS Code 1.92+, and Python with Playwright only for screenshot regeneration.",
        `Top-level guide sections include ${joinPreview(readmeHeadings.slice(0, 5))}.`,
        "Desktop, VS Code, CLI, and browser previews are treated as first-class entry points."
      ],
      commands: ["npm install", "npm run compile", "npm run desktop", "npm run preview:extension"]
    },
    {
      id: "auth",
      title: "Supabase auth and callback flow",
      source: "README.md + docs/DEVELOPMENT.md",
      summary: "Authentication is local-development friendly: browser-based login, temporary localhost callback capture, secure session restore, and future deep-link readiness.",
      bullets: [
        "The documented callback URL is http://localhost:54321/auth/callback.",
        "VS Code stores sessions in SecretStorage; the desktop app uses encrypted local storage via Electron safeStorage.",
        `Auth setup coverage includes ${joinPreview(developmentHeadings.filter((heading) => heading.includes("Auth")).slice(0, 2))}.`
      ],
      commands: ["npm run auth:check", "Magnexis: Sign In", "Magnexis: Refresh Session"]
    },
    {
      id: "providers",
      title: "Provider routing and verified limits",
      source: "docs/PROVIDERS.md + @magnexis/llm-router",
      summary: "Magnexis is a connector, not a model host. Provider presets, verified context metadata, local guardrails, and route defaults all come from shared packages.",
      bullets: [
        `Supported provider policy headings include ${joinPreview(providerHeadings.slice(0, 4))}.`,
        `${providerPresets.length} provider presets and ${listVerifiedModels().length} pinned models are currently exposed by the shared router.`,
        "Gateway and local endpoints are explicitly marked as endpoint-reported instead of invented."
      ],
      commands: ["npm run cli -- providers openai", "npm run cli -- doctor --workspace ."]
    },
    {
      id: "safety",
      title: "Safety and approval boundaries",
      source: "README.md + docs/SECURITY.md",
      summary: "The product stays approval-first: no hidden file edits, no hidden command execution, no raw secret logging, and explicit treatment of sensitive files.",
      bullets: [
        `Security guidance covers ${joinPreview(securityHeadings.slice(0, 5))}.`,
        `The default approval mode is ${defaultMagnexisConfig.approvalMode}. Auto-apply and auto-run commands both default to disabled.`,
        `${toolCatalog.filter((tool) => tool.requiresApproval).length + installableToolCatalog.filter((tool) => tool.requiresApproval).length} current tool descriptors require approval.`
      ]
    }
  ];
}

function readPackageVersion(repoRoot: string): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(#|##|###)\s+/.test(line))
    .map((line) => line.replace(/^(#|##|###)\s+/, "").trim());
}

function humanizeAssetName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+\-?/, "")
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function joinPreview(items: string[]): string {
  return items.length ? items.join(", ") : "the current guides";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
