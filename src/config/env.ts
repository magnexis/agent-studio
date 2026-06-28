import * as vscode from "vscode";
import { loadAuthEnvironment, validateAuthEnvironment, type AuthEnvironment } from "../../packages/auth/src";

export interface ExtensionAuthEnvironmentResult {
  environment: AuthEnvironment;
  warnings: string[];
}

export function loadExtensionAuthEnvironment(): ExtensionAuthEnvironmentResult {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const environment = loadAuthEnvironment({ cwd: workspaceRoot, env: process.env });
  return {
    environment,
    warnings: validateAuthEnvironment(environment)
  };
}
