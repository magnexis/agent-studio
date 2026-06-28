import * as vscode from "vscode";
import type { ExtensionAuthDependencies } from "./commands";
import { resolveExtensionAuth } from "./commands";

export function registerProtectedCommands(dependencies: ExtensionAuthDependencies): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("magnexis.cloudWorkflows", async () => {
      try {
        const auth = await resolveExtensionAuth(dependencies.context);
        const authenticated = await auth.service.isAuthenticated();
        if (!authenticated) {
          const choice = await vscode.window.showInformationMessage(
            "Cloud workflows are protected. Sign in to continue.",
            "Sign In",
            "Cancel"
          );
          if (choice === "Sign In") {
            await vscode.commands.executeCommand("magnexis.auth.signIn");
          }
          return;
        }
        const user = await auth.service.getCurrentUser();
        vscode.window.showInformationMessage(`Protected workspace access granted for ${user?.email ?? user?.id ?? "your account"}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(message);
      }
    })
  ];
}
