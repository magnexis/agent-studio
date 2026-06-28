import * as vscode from "vscode";
import type { AuthStatus } from "../../packages/auth/src";

export class AuthStatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
    this.item.name = "Magnexis Authentication";
    this.item.command = "magnexis.auth.showAccount";
    this.item.show();
    this.setSignedOut();
  }

  setLoading(label = "Checking account"): void {
    this.item.text = `$(loading~spin) ${label}`;
    this.item.tooltip = "Refreshing Magnexis authentication status";
  }

  setSignedOut(): void {
    this.item.text = "$(account) Signed out";
    this.item.tooltip = "No Magnexis cloud account is active";
  }

  setSignedIn(identity: string): void {
    this.item.text = `$(account) ${identity}`;
    this.item.tooltip = `Signed in as ${identity}`;
  }

  applyStatus(status: AuthStatus): void {
    if (!status.authenticated || !status.user) {
      this.setSignedOut();
      return;
    }

    const identity = status.user.email ?? status.user.username ?? status.user.displayName ?? "Account";
    this.setSignedIn(identity);
  }

  dispose(): void {
    this.item.dispose();
  }
}
