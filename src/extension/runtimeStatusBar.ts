import * as vscode from "vscode";
import { providerPresets } from "../../packages/llm-router/src";
import { getModel, getProviderConfig, providerIds, type ProviderId } from "../provider";

type RuntimeAction =
  | "provider"
  | "model"
  | "mode"
  | "reasoning"
  | "autoContext"
  | "settings";

export class RuntimeStatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.name = "Magnexis Runtime";
    this.item.command = "magnexis.selectRuntime";
    this.item.show();
    this.refresh();
  }

  refresh(): void {
    const provider = getProviderConfig();
    const model = getModel();
    const config = vscode.workspace.getConfiguration("magnexis");
    const mode = config.get<string>("approvalMode", "agent");
    const autoContext = config.get<boolean>("autoContext", true);
    this.item.text = `$(server-environment) ${provider.label} / ${model}`;
    this.item.tooltip = [
      `Provider: ${provider.label}`,
      `Model: ${model}`,
      `Mode: ${formatMode(mode)}`,
      `Auto context: ${autoContext ? "On" : "Off"}`,
      "",
      "Click to switch models or quick settings."
    ].join("\n");
  }

  async openQuickPick(): Promise<void> {
    const config = vscode.workspace.getConfiguration("magnexis");
    const currentProvider = getProviderConfig();
    const currentModel = getModel();
    const currentMode = config.get<string>("approvalMode", "agent");
    const currentReasoning = config.get<string>("reasoningEffort", "medium");
    const currentAutoContext = config.get<boolean>("autoContext", true);

    const action = await vscode.window.showQuickPick<RuntimePickerItem>([
      {
        label: `$(plug) Provider`,
        description: currentProvider.label,
        detail: "Change the active external provider route.",
        action: "provider"
      },
      {
        label: `$(symbol-class) Model`,
        description: currentModel,
        detail: "Choose a model from the current provider catalog.",
        action: "model"
      },
      {
        label: `$(shield) Mode`,
        description: formatMode(currentMode),
        detail: "Switch between chat, agent, and full-access behavior.",
        action: "mode"
      },
      {
        label: `$(pulse) Reasoning`,
        description: capitalize(currentReasoning),
        detail: "Adjust how much effort the agent spends planning and checking.",
        action: "reasoning"
      },
      {
        label: `$(layers) Auto context`,
        description: currentAutoContext ? "On" : "Off",
        detail: "Toggle automatic editor context attachment.",
        action: "autoContext"
      },
      {
        label: `$(gear) Open settings`,
        description: "Magnexis settings",
        detail: "Open the full settings surface.",
        action: "settings"
      }
    ], {
      placeHolder: "Select a model or quick runtime setting"
    });

    if (!action) {
      return;
    }

    switch (action.action) {
      case "provider":
        await this.pickProvider();
        break;
      case "model":
        await this.pickModel();
        break;
      case "mode":
        await this.pickMode();
        break;
      case "reasoning":
        await this.pickReasoning();
        break;
      case "autoContext":
        await config.update("autoContext", !currentAutoContext, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Magnexis auto context ${!currentAutoContext ? "enabled" : "disabled"}.`);
        break;
      case "settings":
        await vscode.commands.executeCommand("magnexis.openSettings");
        break;
      default:
        break;
    }

    this.refresh();
  }

  dispose(): void {
    this.item.dispose();
  }

  private async pickProvider(): Promise<void> {
    const current = getProviderConfig().id;
    const selection = await vscode.window.showQuickPick(
      providerIds.map<RuntimePickerItem>((id) => {
        const preset = providerPresets.find((item) => normalizeProviderId(item.id) === id);
        const provider = id === "custom" ? { label: "Custom", baseUrl: vscode.workspace.getConfiguration("magnexis").get<string>("customBaseUrl", "") } : undefined;
        return {
          label: `${id === current ? "$(check) " : ""}${preset?.name ?? provider?.label ?? id}`,
          description: preset?.isLocal ? "Local" : "Cloud",
          detail: preset?.description ?? provider?.baseUrl ?? "Custom OpenAI-compatible endpoint",
          action: "provider",
          value: id
        };
      }),
      { placeHolder: "Choose the active provider route" }
    );

    if (!selection?.value) {
      return;
    }

    const nextProvider = selection.value as ProviderId;
    await vscode.workspace.getConfiguration("magnexis").update("provider", nextProvider, vscode.ConfigurationTarget.Workspace);

    const models = getModelsForProvider(nextProvider);
    if (models.length) {
      await vscode.workspace.getConfiguration("magnexis").update("model", models[0], vscode.ConfigurationTarget.Workspace);
    }
  }

  private async pickModel(): Promise<void> {
    const currentProvider = getProviderConfig().id;
    const currentModel = getModel();
    const models = getModelsForProvider(currentProvider);

    if (!models.length) {
      vscode.window.showInformationMessage("This provider does not have pinned catalog models yet. Use Provider Settings to enter a custom model.");
      return;
    }

    const selection = await vscode.window.showQuickPick(
      models.map<RuntimePickerItem>((model) => ({
        label: `${model === currentModel ? "$(check) " : ""}${model}`,
        description: currentProvider,
        detail: "Update the active model for Magnexis requests.",
        action: "model",
        value: model
      })),
      { placeHolder: "Choose a model" }
    );

    if (!selection?.value) {
      return;
    }

    await vscode.workspace.getConfiguration("magnexis").update("model", selection.value, vscode.ConfigurationTarget.Workspace);
  }

  private async pickMode(): Promise<void> {
    const currentMode = vscode.workspace.getConfiguration("magnexis").get<string>("approvalMode", "agent");
    const selection = await vscode.window.showQuickPick<RuntimePickerItem>([
      { label: `${currentMode === "chat" ? "$(check) " : ""}Chat`, detail: "No tool use; question-answering only.", action: "mode", value: "chat" },
      { label: `${currentMode === "agent" ? "$(check) " : ""}Agent`, detail: "Workspace tools with approval-first behavior.", action: "mode", value: "agent" },
      { label: `${currentMode === "fullAccess" ? "$(check) " : ""}Full Access`, detail: "Tools without prompts in trusted workspaces.", action: "mode", value: "fullAccess" }
    ], { placeHolder: "Choose agent mode" });

    if (!selection?.value) {
      return;
    }

    await vscode.workspace.getConfiguration("magnexis").update("approvalMode", selection.value, vscode.ConfigurationTarget.Workspace);
  }

  private async pickReasoning(): Promise<void> {
    const currentReasoning = vscode.workspace.getConfiguration("magnexis").get<string>("reasoningEffort", "medium");
    const selection = await vscode.window.showQuickPick<RuntimePickerItem>([
      { label: `${currentReasoning === "low" ? "$(check) " : ""}Low`, detail: "Fastest route with minimal extra checking.", action: "reasoning", value: "low" },
      { label: `${currentReasoning === "medium" ? "$(check) " : ""}Medium`, detail: "Balanced planning and responsiveness.", action: "reasoning", value: "medium" },
      { label: `${currentReasoning === "high" ? "$(check) " : ""}High`, detail: "More deliberate planning and deeper checks.", action: "reasoning", value: "high" }
    ], { placeHolder: "Choose reasoning effort" });

    if (!selection?.value) {
      return;
    }

    await vscode.workspace.getConfiguration("magnexis").update("reasoningEffort", selection.value, vscode.ConfigurationTarget.Workspace);
  }
}

interface RuntimePickerItem extends vscode.QuickPickItem {
  action: RuntimeAction;
  value?: string;
}

function getModelsForProvider(providerId: ProviderId): string[] {
  const preset = providerPresets.find((item) => normalizeProviderId(item.id) === providerId);
  return (preset?.models ?? []).map((model) => model.id);
}

function normalizeProviderId(value: string): ProviderId {
  return value === "custom-openai-compatible" ? "custom" : value as ProviderId;
}

function formatMode(mode: string): string {
  switch (mode) {
    case "chat":
      return "Chat";
    case "fullAccess":
      return "Full Access";
    default:
      return "Agent";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
