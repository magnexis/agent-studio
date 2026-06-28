(function () {
  const vscode = typeof acquireVsCodeApi === "function"
    ? acquireVsCodeApi()
    : {
        postMessage() {},
        getState() {
          return {};
        },
        setState() {}
      };

  const state = {
    threads: [],
    activeThreadId: "",
    provider: "zai",
    providerLabel: "Z.ai",
    model: "glm-5.1",
    mode: "agent",
    reasoning: "medium",
    autoContext: true,
    isStreaming: false,
    slashIndex: 0,
    providerFilter: "all",
    selectedProvider: "zai",
    selectedModel: "glm-5.1",
    ...vscode.getState()
  };

  const catalog = window.magnexisProviderCatalog || {};

  const ui = {
    body: document.body,
    providerLabel: document.getElementById("provider"),
    providerChip: document.getElementById("providerChip"),
    modeChip: document.getElementById("modeChip"),
    prompt: document.getElementById("prompt"),
    form: document.getElementById("composer"),
    send: document.getElementById("send"),
    messages: document.getElementById("messages"),
    emptyState: document.getElementById("emptyState"),
    slashMenu: document.getElementById("slashMenu"),
    quickbar: document.querySelector(".quickbar"),
    toggleThreads: document.getElementById("toggleThreads"),
    closeThreads: document.getElementById("closeThreads"),
    threadBackdrop: document.getElementById("threadBackdrop"),
    threadRail: document.getElementById("threadRail"),
    threadSearch: document.getElementById("threadSearch"),
    threadList: document.getElementById("threadList"),
    threadEmpty: document.getElementById("threadEmpty"),
    newThreadAction: document.getElementById("newThreadAction"),
    newThreadRailAction: document.getElementById("newThreadRailAction"),
    toggleContext: document.getElementById("toggleContext"),
    closeContext: document.getElementById("closeContext"),
    contextBackdrop: document.getElementById("contextBackdrop"),
    contextRail: document.getElementById("contextRail"),
    workspacePath: document.getElementById("workspacePath"),
    workspaceSummary: document.getElementById("workspaceSummary"),
    workflowTemplates: document.getElementById("workflowTemplates"),
    workspaceConfig: document.getElementById("workspaceConfig"),
    contextChip: document.getElementById("contextChip"),
    settingsButton: document.getElementById("settings"),
    settingsPanel: document.getElementById("settingsPanel"),
    statusAction: document.getElementById("statusAction"),
    openBesideAction: document.getElementById("openBesideAction"),
    popoutAction: document.getElementById("popoutAction"),
    moreActions: document.getElementById("moreActions"),
    headerMenu: document.getElementById("headerMenu"),
    modeSelect: document.getElementById("modeSelect"),
    reasoningSelect: document.getElementById("reasoningSelect"),
    autoContextInput: document.getElementById("autoContextInput"),
    composerModelTrigger: document.getElementById("composerModelTrigger"),
    composerModelLabel: document.querySelector(".composer-select-label"),
    contextMenuToggle: document.getElementById("contextMenuToggle"),
    contextMenu: document.getElementById("contextMenu"),
    providerPicker: document.getElementById("providerPicker"),
    closeProviderPicker: document.getElementById("closeProviderPicker"),
    cancelProviderPicker: document.getElementById("cancelProviderPicker"),
    saveProviderPicker: document.getElementById("saveProviderPicker"),
    providerSearch: document.getElementById("providerSearch"),
    providerFilterTabs: document.querySelector(".provider-filter-tabs"),
    providerChoiceGrid: document.querySelector(".provider-choice-grid"),
    providerEmpty: document.getElementById("providerEmpty"),
    providerSelect: document.getElementById("providerSelect"),
    modelInput: document.getElementById("modelInput"),
    modelSource: document.getElementById("modelSource"),
    modelContext: document.getElementById("modelContext"),
    modelDocs: document.getElementById("modelDocs"),
    customModelField: document.getElementById("customModelField"),
    customModelInput: document.getElementById("customModelInput"),
    refreshModels: document.getElementById("refreshModels"),
    providerApiKey: document.getElementById("providerApiKey")
  };

  const slashCommands = [
    { command: "/review", desc: "Review current workspace changes" },
    { command: "/plan", desc: "Shape a multi-step approach before acting" },
    { command: "/diff", desc: "Show the current Git diff" },
    { command: "/status", desc: "Show route, model, and session state" },
    { command: "/goal", desc: "Set a concise agent goal" }
  ];

  function persistState() {
    vscode.setState(state);
  }

  function setStreaming(isStreaming) {
    state.isStreaming = isStreaming;
    if (ui.send) {
      ui.send.disabled = isStreaming;
      ui.send.classList.toggle("is-streaming", isStreaming);
      ui.send.innerHTML = '<span class="send-icon" aria-hidden="true">&#8593;</span>';
    }
    if (isStreaming) {
      ensureStreamingMessage();
    }
    persistState();
  }

  function adjustPromptHeight() {
    if (!ui.prompt) return;
    ui.prompt.style.height = "auto";
    ui.prompt.style.height = `${Math.min(ui.prompt.scrollHeight, 180)}px`;
  }

  function scrollToBottom() {
    if (!ui.messages) return;
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function createMessage(role, content, extraClass) {
    const article = document.createElement("article");
    article.className = `message ${role}${extraClass ? ` ${extraClass}` : ""}`;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : role === "assistant" ? "Assistant" : role;

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = content;

    article.append(label, body);
    return article;
  }

  function clearMessages() {
    if (!ui.messages) return;
    ui.messages.querySelectorAll(".message, .activity-card, .change-proposal").forEach((node) => node.remove());
    if (ui.emptyState) ui.emptyState.hidden = false;
  }

  function appendMessage(role, content, extraClass) {
    if (!ui.messages || !content) return;
    if (ui.emptyState) ui.emptyState.hidden = true;
    ui.messages.append(createMessage(role, content, extraClass));
    scrollToBottom();
  }

  function getStreamingMessage() {
    return ui.messages?.querySelector(".message.assistant.streaming .message-body") ?? null;
  }

  function ensureStreamingMessage() {
    if (!ui.messages) return null;
    if (ui.emptyState) ui.emptyState.hidden = true;
    let article = ui.messages.querySelector(".message.assistant.streaming");
    if (!article) {
      article = createMessage("assistant", "", "streaming typing");
      const body = article.querySelector(".message-body");
      if (body) {
        body.innerHTML = '<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
      }
      ui.messages.append(article);
      scrollToBottom();
    }
    return article;
  }

  function appendAssistantDelta(content) {
    if (!ui.messages || !content) return;
    if (ui.emptyState) ui.emptyState.hidden = true;
    const article = ensureStreamingMessage();
    let body = article?.querySelector(".message-body") ?? getStreamingMessage();
    article?.classList.remove("typing");
    if (body && body.querySelector(".typing-dots")) {
      body.textContent = "";
    }
    body.textContent += content;
    scrollToBottom();
  }

  function finalizeAssistant(content) {
    if (!ui.messages) return;
    const article = ui.messages.querySelector(".message.assistant.streaming");
    if (article) {
      article.classList.remove("streaming");
      article.classList.remove("typing");
      const body = article.querySelector(".message-body");
      if (body) body.textContent = content;
    } else {
      appendMessage("assistant", content);
    }
    setStreaming(false);
  }

  function appendStatus(content, kind) {
    appendMessage(kind === "error" ? "error" : "status", content, kind === "error" ? "" : undefined);
  }

  function renderTranscript(entries) {
    clearMessages();
    if (!entries?.length) return;
    entries.forEach((entry) => appendMessage(entry.role, entry.content));
  }

  function renderThreads() {
    if (!ui.threadList) return;
    const query = (ui.threadSearch?.value || "").trim().toLowerCase();
    const items = state.threads.filter((thread) => {
      if (!query) return true;
      return `${thread.title} ${thread.messageCount}`.toLowerCase().includes(query);
    });

    ui.threadList.replaceChildren();
    items.forEach((thread) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `thread-item${thread.id === state.activeThreadId ? " active" : ""}`;
      button.innerHTML = `<strong>${escapeHtml(thread.title)}</strong><span>${formatThreadMeta(thread)}</span>`;
      button.addEventListener("click", () => {
        vscode.postMessage({ type: "switchThread", threadId: thread.id });
        closeThreads();
      });
      ui.threadList.append(button);
    });

    if (ui.threadEmpty) {
      ui.threadEmpty.hidden = items.length > 0;
    }
  }

  function formatThreadMeta(thread) {
    const updated = new Date(thread.updatedAt);
    const time = Number.isNaN(updated.getTime()) ? "recent" : updated.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `${time} - ${thread.messageCount} message${thread.messageCount === 1 ? "" : "s"}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function openThreads() {
    ui.body?.classList.add("threads-open");
    ui.toggleThreads?.setAttribute("aria-expanded", "true");
  }

  function closeThreads() {
    ui.body?.classList.remove("threads-open");
    ui.toggleThreads?.setAttribute("aria-expanded", "false");
  }

  function openContext() {
    ui.body?.classList.add("context-open");
    ui.toggleContext?.setAttribute("aria-expanded", "true");
  }

  function closeContext() {
    ui.body?.classList.remove("context-open");
    ui.toggleContext?.setAttribute("aria-expanded", "false");
  }

  function closeHeaderMenu() {
    if (ui.headerMenu) ui.headerMenu.hidden = true;
    ui.moreActions?.setAttribute("aria-expanded", "false");
  }

  function openHeaderMenu() {
    if (ui.headerMenu) ui.headerMenu.hidden = false;
    ui.moreActions?.setAttribute("aria-expanded", "true");
  }

  function closeContextMenu() {
    if (ui.contextMenu) ui.contextMenu.hidden = true;
    ui.contextMenuToggle?.setAttribute("aria-expanded", "false");
  }

  function openContextMenu() {
    if (ui.contextMenu) ui.contextMenu.hidden = false;
    ui.contextMenuToggle?.setAttribute("aria-expanded", "true");
  }

  function openProviderPicker() {
    if (ui.providerPicker) ui.providerPicker.hidden = false;
    renderProviderChoices();
    populateModelOptions(state.selectedProvider, state.selectedModel);
    ui.providerSearch?.focus();
  }

  function closeProviderPicker() {
    if (ui.providerPicker) ui.providerPicker.hidden = true;
  }

  function normalizeProviderId(providerId) {
    return providerId === "custom-openai-compatible" ? "custom" : providerId;
  }

  function getProviderRecord(providerId) {
    return catalog[providerId] || null;
  }

  function renderProviderChoices() {
    if (!ui.providerChoiceGrid) return;
    const query = (ui.providerSearch?.value || "").trim().toLowerCase();
    const filter = state.providerFilter;
    let visible = 0;
    ui.providerChoiceGrid.querySelectorAll("[data-provider]").forEach((button) => {
      const providerId = button.getAttribute("data-provider");
      const kind = button.getAttribute("data-provider-kind");
      const matchesFilter = filter === "all" || filter === kind;
      const matchesQuery = !query || button.textContent.toLowerCase().includes(query);
      const show = matchesFilter && matchesQuery;
      button.hidden = !show;
      button.classList.toggle("selected", providerId === state.selectedProvider);
      if (show) visible += 1;
    });
    if (ui.providerEmpty) ui.providerEmpty.hidden = visible > 0;
  }

  function populateModelOptions(providerId, selectedModel, discoveredModels) {
    if (!ui.modelInput) return;
    const provider = getProviderRecord(providerId);
    const modelList = Array.from(new Set([
      ...(discoveredModels || []),
      ...((provider?.models || []).map((model) => model.id))
    ]));
    ui.modelInput.replaceChildren();
    modelList.forEach((modelId) => {
      ui.modelInput.add(new Option(modelId, modelId));
    });
    ui.modelInput.add(new Option("Custom model...", "__custom__"));

    if (selectedModel && modelList.includes(selectedModel)) {
      ui.modelInput.value = selectedModel;
      if (ui.customModelInput) ui.customModelInput.value = "";
    } else if (selectedModel) {
      ui.modelInput.value = "__custom__";
      if (ui.customModelInput) ui.customModelInput.value = selectedModel;
    } else {
      ui.modelInput.value = modelList[0] || "__custom__";
    }

    updateCustomModelVisibility();
    updateModelVerification(providerId, selectedModel || modelList[0] || "");
    if (ui.modelSource) {
      ui.modelSource.textContent = discoveredModels?.length
        ? `${discoveredModels.length} models reported by the provider.`
        : "Showing supported presets.";
    }
  }

  function selectedModelValue() {
    if (!ui.modelInput) return state.model;
    return ui.modelInput.value === "__custom__"
      ? (ui.customModelInput?.value.trim() || state.model)
      : ui.modelInput.value;
  }

  function updateCustomModelVisibility() {
    if (!ui.customModelField || !ui.modelInput) return;
    ui.customModelField.hidden = ui.modelInput.value !== "__custom__";
  }

  function updateModelVerification(providerId, modelId) {
    const provider = getProviderRecord(providerId);
    const model = provider?.models?.find((entry) => entry.id === modelId);
    if (ui.modelContext) {
      ui.modelContext.textContent = model?.contextWindow
        ? `${model.contextWindow.toLocaleString()} tokens`
        : "Reported by endpoint";
    }
    if (ui.modelDocs) {
      const verified = Boolean(model?.contextSourceUrl);
      ui.modelDocs.hidden = !verified;
      ui.modelDocs.textContent = verified ? `Verified ${model.contextVerifiedAt || ""}`.trim() : "";
    }
  }

  function updateProviderDisplay(meta) {
    state.provider = normalizeProviderId(meta.provider || state.provider);
    state.providerLabel = meta.providerLabel || state.providerLabel;
    state.model = meta.model || state.model;
    state.mode = meta.mode || state.mode;
    state.reasoning = meta.reasoning || state.reasoning;
    state.autoContext = Boolean(meta.autoContext);
    state.selectedProvider = state.provider;
    state.selectedModel = state.model;

    if (ui.providerLabel) {
      ui.providerLabel.textContent = meta.label || `${state.providerLabel} / ${state.model}`;
    }
    if (ui.providerChip) {
      ui.providerChip.textContent = `${state.providerLabel} / ${state.model}`;
    }
    if (ui.composerModelLabel) {
      ui.composerModelLabel.textContent = state.model;
    }
    if (ui.modeChip) {
      ui.modeChip.textContent = state.mode === "fullAccess" ? "Full Access" : capitalize(state.mode);
    }
    if (ui.modeSelect) ui.modeSelect.value = state.mode;
    if (ui.reasoningSelect) ui.reasoningSelect.value = state.reasoning;
    if (ui.autoContextInput) ui.autoContextInput.checked = state.autoContext;
    if (ui.contextChip) ui.contextChip.textContent = state.autoContext ? "Auto context" : "Manual context";

    persistState();
  }

  function updateWorkspaceSnapshot(message) {
    if (ui.workspacePath) {
      ui.workspacePath.textContent = message.configPath || "No workspace config loaded.";
    }
    if (ui.workspaceSummary) {
      ui.workspaceSummary.replaceChildren();
      (message.quickGoalPrompts || []).forEach((prompt) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workspace-chip";
        button.textContent = prompt;
        button.addEventListener("click", () => {
          if (!ui.prompt) return;
          ui.prompt.value = prompt;
          adjustPromptHeight();
          ui.prompt.focus();
        });
        ui.workspaceSummary.append(button);
      });
    }
    if (ui.workflowTemplates) {
      ui.workflowTemplates.replaceChildren();
      (message.workflowTemplates || []).forEach((workflow) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workflow-card";
        button.innerHTML = `<strong>${escapeHtml(workflow.name)}</strong><span>${escapeHtml(workflow.description)}</span><small>${escapeHtml(workflow.modelPreference)}</small>`;
        button.addEventListener("click", () => {
          if (!ui.prompt) return;
          ui.prompt.value = workflow.promptTemplate;
          adjustPromptHeight();
          ui.prompt.focus();
        });
        ui.workflowTemplates.append(button);
      });
    }
    if (ui.workspaceConfig) {
      ui.workspaceConfig.replaceChildren();
      (message.configSummary || []).forEach((line) => {
        const row = document.createElement("div");
        row.className = "workspace-row";
        row.textContent = line;
        ui.workspaceConfig.append(row);
      });
    }
  }

  function renderSlashMenu() {
    if (!ui.prompt || !ui.slashMenu) return;
    const value = ui.prompt.value.trimStart();
    if (!value.startsWith("/")) {
      ui.slashMenu.hidden = true;
      return;
    }
    const filtered = slashCommands.filter((item) => item.command.startsWith(value.toLowerCase()));
    if (!filtered.length) {
      ui.slashMenu.hidden = true;
      return;
    }

    state.slashIndex = Math.min(state.slashIndex, filtered.length - 1);
    ui.slashMenu.innerHTML = filtered.map((item, index) => `
      <button type="button" class="slash-item${index === state.slashIndex ? " active" : ""}" data-command="${item.command}">
        <code>${item.command}</code>
        <span>${escapeHtml(item.desc)}</span>
      </button>
    `).join("");
    ui.slashMenu.hidden = false;

    ui.slashMenu.querySelectorAll(".slash-item").forEach((button, index) => {
      button.addEventListener("mouseenter", () => {
        state.slashIndex = index;
        renderSlashMenu();
      });
      button.addEventListener("click", () => {
        execSlashCommand(button.getAttribute("data-command"));
      });
    });
  }

  function execSlashCommand(command) {
    if (!ui.prompt) return;
    ui.prompt.value = `${command} `;
    ui.slashMenu.hidden = true;
    adjustPromptHeight();
    ui.prompt.focus();
  }

  function handleIncomingMessage(event) {
    const message = event.data || {};
    switch (message.type) {
      case "provider":
        updateProviderDisplay(message);
        break;
      case "workspace":
        updateWorkspaceSnapshot(message);
        break;
      case "transcript":
        renderTranscript(message.entries || []);
        break;
      case "threads":
        state.threads = message.threads || [];
        state.activeThreadId = message.activeThreadId || "";
        renderThreads();
        persistState();
        break;
      case "providerModels":
        if (message.provider === state.selectedProvider && message.ok) {
          populateModelOptions(message.provider, selectedModelValue(), message.models || []);
        } else if (ui.modelSource) {
          ui.modelSource.textContent = message.detail || "Provider model lookup failed.";
        }
        if (ui.refreshModels) {
          ui.refreshModels.disabled = false;
          ui.refreshModels.textContent = "Refresh models";
        }
        break;
      case "assistant_delta":
        appendAssistantDelta(message.content || "");
        break;
      case "assistant":
        finalizeAssistant(message.content || "");
        break;
      case "user":
        appendMessage("user", message.content || "");
        break;
      case "status":
        appendStatus(message.content || "", "status");
        break;
      case "error":
        setStreaming(false);
        appendStatus(message.message || "Unknown error", "error");
        break;
      case "applied":
        appendStatus(`Applied ${message.count || 0} edit${message.count === 1 ? "" : "s"}.`, "status");
        break;
      default:
        break;
    }
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function dismissOverlays() {
    closeHeaderMenu();
    closeContextMenu();
    closeProviderPicker();
    ui.slashMenu.hidden = true;
  }

  function postSettingsUpdate() {
    state.mode = ui.modeSelect?.value || state.mode;
    state.reasoning = ui.reasoningSelect?.value || state.reasoning;
    state.autoContext = Boolean(ui.autoContextInput?.checked);
    if (ui.modeChip) {
      ui.modeChip.textContent = state.mode === "fullAccess" ? "Full Access" : capitalize(state.mode);
    }
    if (ui.contextChip) {
      ui.contextChip.textContent = state.autoContext ? "Auto context" : "Manual context";
    }
    vscode.postMessage({
      type: "updateSettings",
      mode: state.mode,
      reasoning: state.reasoning,
      autoContext: state.autoContext
    });
    persistState();
  }

  function init() {
    if (!ui.form || !ui.prompt || !ui.messages) return;

    adjustPromptHeight();
    updateProviderDisplay({
      provider: state.provider,
      providerLabel: state.providerLabel,
      model: state.model,
      mode: state.mode,
      reasoning: state.reasoning,
      autoContext: state.autoContext
    });
    renderThreads();
    if (ui.send) {
      ui.send.innerHTML = '<span class="send-icon" aria-hidden="true">&#8593;</span>';
    }

    ui.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const prompt = ui.prompt.value.trim();
      if (!prompt || state.isStreaming) return;
      ui.prompt.value = "";
      adjustPromptHeight();
      ui.slashMenu.hidden = true;
      setStreaming(true);
      vscode.postMessage({ type: "sendPrompt", prompt });
    });

    ui.prompt.addEventListener("input", () => {
      adjustPromptHeight();
      renderSlashMenu();
    });

    ui.prompt.addEventListener("keydown", (event) => {
      if (!ui.slashMenu.hidden) {
        const items = Array.from(ui.slashMenu.querySelectorAll(".slash-item"));
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          state.slashIndex = (state.slashIndex + delta + items.length) % items.length;
          renderSlashMenu();
          return;
        }
        if (event.key === "Enter" && items.length) {
          event.preventDefault();
          execSlashCommand(items[state.slashIndex].getAttribute("data-command"));
          return;
        }
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        ui.form.requestSubmit();
      }
      if (event.key === "Escape") {
        dismissOverlays();
      }
    });

    ui.quickbar?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-prompt]");
      if (!button) return;
      ui.prompt.value = button.getAttribute("data-prompt");
      adjustPromptHeight();
      ui.prompt.focus();
    });

    ui.emptyState?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-prompt]");
      if (!button) return;
      ui.prompt.value = button.getAttribute("data-prompt");
      adjustPromptHeight();
      ui.prompt.focus();
    });

    ui.newThreadAction?.addEventListener("click", () => vscode.postMessage({ type: "newThread" }));
    ui.newThreadRailAction?.addEventListener("click", () => vscode.postMessage({ type: "newThread" }));
    ui.toggleThreads?.addEventListener("click", () => {
      if (ui.body.classList.contains("threads-open")) closeThreads();
      else openThreads();
    });
    ui.closeThreads?.addEventListener("click", closeThreads);
    ui.threadBackdrop?.addEventListener("click", closeThreads);
    ui.threadSearch?.addEventListener("input", renderThreads);

    ui.toggleContext?.addEventListener("click", () => {
      if (ui.body.classList.contains("context-open")) closeContext();
      else openContext();
    });
    ui.closeContext?.addEventListener("click", closeContext);
    ui.contextBackdrop?.addEventListener("click", closeContext);

    ui.moreActions?.addEventListener("click", () => {
      if (ui.headerMenu?.hidden) openHeaderMenu();
      else closeHeaderMenu();
    });
    ui.openBesideAction?.addEventListener("click", () => vscode.postMessage({ type: "openBeside" }));
    ui.popoutAction?.addEventListener("click", () => vscode.postMessage({ type: "popOut" }));
    ui.settingsPanel?.addEventListener("click", () => vscode.postMessage({ type: "openSettings" }));
    ui.settingsButton?.addEventListener("click", () => vscode.postMessage({ type: "setApiKey" }));
    ui.statusAction?.addEventListener("click", () => appendStatus(`Provider ${state.providerLabel} / ${state.model} - mode ${state.mode} - reasoning ${state.reasoning}.`, "status"));

    ui.contextMenuToggle?.addEventListener("click", () => {
      if (ui.contextMenu?.hidden) openContextMenu();
      else closeContextMenu();
    });
    ui.contextMenu?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-context-action]");
      if (!button) return;
      const action = button.getAttribute("data-context-action");
      if (action === "selection") vscode.postMessage({ type: "attachSelection" });
      if (action === "file") vscode.postMessage({ type: "attachFile" });
      if (action === "workspace" || action === "panel") openContext();
      closeContextMenu();
    });

    ui.providerChip?.addEventListener("click", openProviderPicker);
    ui.composerModelTrigger?.addEventListener("click", openProviderPicker);
    ui.closeProviderPicker?.addEventListener("click", closeProviderPicker);
    ui.cancelProviderPicker?.addEventListener("click", closeProviderPicker);
    ui.providerPicker?.addEventListener("click", (event) => {
      if (event.target === ui.providerPicker) closeProviderPicker();
    });

    ui.providerSearch?.addEventListener("input", renderProviderChoices);
    ui.providerFilterTabs?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-provider-filter]");
      if (!button) return;
      state.providerFilter = button.getAttribute("data-provider-filter");
      ui.providerFilterTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderProviderChoices();
      persistState();
    });
    ui.providerChoiceGrid?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-provider]");
      if (!button) return;
      state.selectedProvider = button.getAttribute("data-provider");
      ui.providerSelect.value = state.selectedProvider;
      const provider = getProviderRecord(state.selectedProvider);
      const defaultModel = provider?.models?.[0]?.id || state.model;
      state.selectedModel = defaultModel;
      renderProviderChoices();
      populateModelOptions(state.selectedProvider, defaultModel);
      persistState();
    });

    ui.modelInput?.addEventListener("change", () => {
      updateCustomModelVisibility();
      updateModelVerification(state.selectedProvider, selectedModelValue());
    });
    ui.customModelInput?.addEventListener("input", () => {
      updateModelVerification(state.selectedProvider, selectedModelValue());
    });

    ui.refreshModels?.addEventListener("click", () => {
      ui.refreshModels.disabled = true;
      ui.refreshModels.textContent = "Refreshing...";
      vscode.postMessage({ type: "listModels", provider: state.selectedProvider });
    });
    ui.providerApiKey?.addEventListener("click", () => {
      vscode.postMessage({ type: "setApiKeyForProvider", provider: state.selectedProvider });
    });
    ui.saveProviderPicker?.addEventListener("click", () => {
      const provider = getProviderRecord(state.selectedProvider);
      const model = selectedModelValue();
      state.provider = state.selectedProvider;
      state.providerLabel = provider?.name || state.selectedProvider;
      state.model = model;
      updateProviderDisplay({
        provider: state.provider,
        providerLabel: state.providerLabel,
        model: state.model,
        mode: state.mode,
        reasoning: state.reasoning,
        autoContext: state.autoContext
      });
      vscode.postMessage({
        type: "updateSettings",
        provider: state.provider,
        model: state.model
      });
      closeProviderPicker();
    });

    ui.modeSelect?.addEventListener("change", postSettingsUpdate);
    ui.reasoningSelect?.addEventListener("change", postSettingsUpdate);
    ui.autoContextInput?.addEventListener("change", postSettingsUpdate);

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".header-actions")) closeHeaderMenu();
      if (!event.target.closest(".context-menu-wrap")) closeContextMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") dismissOverlays();
    });
    window.addEventListener("message", handleIncomingMessage);
  }

  init();
})();
