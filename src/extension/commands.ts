import * as vscode from "vscode";
import { AuthService, SupabaseAuthProvider, type AuthEnvironment, type AuthSignInInput, type SecureKeyValueStore } from "../../packages/auth/src";
import { loadExtensionAuthEnvironment } from "../config/env";
import { AuthStatusBarController } from "./statusBar";

export interface ExtensionAuthDependencies {
  context: vscode.ExtensionContext;
  statusBar: AuthStatusBarController;
}

export interface ExtensionAuthResolved {
  service: AuthService;
  environment: AuthEnvironment;
}

export function registerAuthCommands(dependencies: ExtensionAuthDependencies): vscode.Disposable[] {
  const { context, statusBar } = dependencies;
  return [
    vscode.commands.registerCommand("magnexis.auth.signIn", async () => {
      await runAuthFlow("sign-in", dependencies, async (auth) => {
        const input = await promptForSignIn();
        if (!input) {
          return;
        }
        await auth.service.signIn(input);
        const status = await auth.service.getStatus();
        statusBar.applyStatus(status);
        const identity = status.user?.email ?? status.user?.username ?? status.user?.displayName ?? "your account";
        vscode.window.showInformationMessage(`Signed in to Magnexis as ${identity}.`);
      });
    }),
    vscode.commands.registerCommand("magnexis.auth.signUp", async () => {
      await runAuthFlow("sign-up", dependencies, async (auth) => {
        const input = await promptForSignUp();
        if (!input) {
          return;
        }
        if ("oauthProvider" in input) {
          await auth.service.signIn({ oauthProvider: input.oauthProvider });
        } else {
          await auth.service.signUp(input);
        }
        const status = await auth.service.getStatus();
        statusBar.applyStatus(status);
        if (status.authenticated) {
          vscode.window.showInformationMessage(`Account ready for ${status.user?.email ?? "Magnexis"}.`);
        } else {
          vscode.window.showInformationMessage("Account created. Check your inbox if Supabase email confirmation is enabled.");
        }
      });
    }),
    vscode.commands.registerCommand("magnexis.auth.signOut", async () => {
      await runAuthFlow("sign-out", dependencies, async (auth) => {
        await auth.service.signOut();
        statusBar.setSignedOut();
        vscode.window.showInformationMessage("Signed out of Magnexis.");
      });
    }),
    vscode.commands.registerCommand("magnexis.auth.showAccount", async () => {
      await runAuthFlow("show-account", dependencies, async (auth) => {
        const status = await auth.service.getStatus();
        statusBar.applyStatus(status);
        if (!status.authenticated || !status.user) {
          const choice = await vscode.window.showInformationMessage(
            "Magnexis is signed out. Sign in to unlock cloud account features.",
            "Sign In",
            "Sign Up"
          );
          if (choice === "Sign In") {
            await vscode.commands.executeCommand("magnexis.auth.signIn");
          }
          if (choice === "Sign Up") {
            await vscode.commands.executeCommand("magnexis.auth.signUp");
          }
          return;
        }

        const identity = status.user.email ?? status.user.username ?? status.user.displayName ?? status.user.id;
        const expiry = status.expiresAt
          ? new Date(status.expiresAt * 1000).toLocaleString()
          : "Session expiry not reported";
        vscode.window.showInformationMessage(`Signed in as ${identity}. Session expires: ${expiry}.`, "Refresh Session", "Sign Out").then(async (choice) => {
          if (choice === "Refresh Session") {
            await vscode.commands.executeCommand("magnexis.auth.refreshSession");
          }
          if (choice === "Sign Out") {
            await vscode.commands.executeCommand("magnexis.auth.signOut");
          }
        });
      });
    }),
    vscode.commands.registerCommand("magnexis.auth.refreshSession", async () => {
      await runAuthFlow("refresh-session", dependencies, async (auth) => {
        const session = await auth.service.refreshSession();
        if (!session) {
          statusBar.setSignedOut();
          vscode.window.showWarningMessage("No active Magnexis session is available. Sign in again to continue.");
          return;
        }
        statusBar.applyStatus(await auth.service.getStatus());
        vscode.window.showInformationMessage(`Session refreshed for ${session.user.email ?? session.user.id}.`);
      });
    }),
    context.secrets.onDidChange(() => {
      void refreshAuthStatus(context, statusBar);
    })
  ];
}

export async function resolveExtensionAuth(context: vscode.ExtensionContext): Promise<ExtensionAuthResolved> {
  const { environment, warnings } = loadExtensionAuthEnvironment();
  if (warnings.length) {
    throw new Error(`Authentication is not configured.\n${warnings.join("\n")}\nCreate a local .env from .env.example and try again.`);
  }

  const secureStore: SecureKeyValueStore = {
    get: async (key) => (await context.secrets.get(key)) ?? null,
    set: async (key, value) => context.secrets.store(key, value),
    delete: async (key) => context.secrets.delete(key)
  };

  const provider = new SupabaseAuthProvider({
    supabaseUrl: environment.SUPABASE_URL,
    supabaseAnonKey: environment.SUPABASE_ANON_KEY,
    secureStore,
    storageKey: "magnexis.supabase.session"
  });

  return {
    environment,
    service: new AuthService({
      provider,
      browserOpener: {
        open: async (url) => {
          const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
          if (!opened) {
            throw new Error("The system browser could not be opened for authentication.");
          }
        }
      },
      callbackUrl: environment.AUTH_CALLBACK_URL,
      callbackPort: environment.AUTH_CALLBACK_PORT
    })
  };
}

export async function refreshAuthStatus(context: vscode.ExtensionContext, statusBar: AuthStatusBarController): Promise<void> {
  try {
    const auth = await resolveExtensionAuth(context);
    const status = await auth.service.getStatus();
    statusBar.applyStatus(status);
  } catch {
    statusBar.setSignedOut();
  }
}

async function runAuthFlow(
  label: string,
  dependencies: ExtensionAuthDependencies,
  action: (auth: ExtensionAuthResolved) => Promise<void>
): Promise<void> {
  const { context, statusBar } = dependencies;
  try {
    statusBar.setLoading();
    const auth = await resolveExtensionAuth(context);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: authProgressTitle(label),
        cancellable: false
      },
      async () => action(auth)
    );
  } catch (error) {
    statusBar.setSignedOut();
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) {
      vscode.window.showWarningMessage("Authentication was canceled before Magnexis received a session.");
      return;
    }
    vscode.window.showErrorMessage(message);
  }
}

async function promptForSignIn(): Promise<AuthSignInInput | undefined> {
  const method = await vscode.window.showQuickPick(
    [
      { label: "Email and Password", value: "password", detail: "Sign in with a Supabase email/password account." },
      { label: "Continue with GitHub", value: "github", detail: "Open the system browser and complete GitHub OAuth." },
      { label: "Continue with Google", value: "google", detail: "Open the system browser and complete Google OAuth." }
    ],
    {
      title: "Sign in to Magnexis",
      ignoreFocusOut: true
    }
  );

  if (!method) {
    return undefined;
  }
  if (method.value === "github" || method.value === "google") {
    return { oauthProvider: method.value };
  }

  const email = await vscode.window.showInputBox({
    title: "Magnexis account email",
    prompt: "Enter the email address for your account.",
    ignoreFocusOut: true
  });
  if (!email) {
    return undefined;
  }
  const password = await vscode.window.showInputBox({
    title: "Magnexis account password",
    prompt: "Enter your password. Magnexis never stores raw passwords.",
    password: true,
    ignoreFocusOut: true
  });
  if (!password) {
    return undefined;
  }
  return { email: email.trim(), password };
}

async function promptForSignUp(): Promise<{ oauthProvider: "github" | "google" } | { email: string; password: string } | undefined> {
  const method = await vscode.window.showQuickPick(
    [
      { label: "Email and Password", value: "password", detail: "Create a Supabase-backed account with email and password." },
      { label: "Continue with GitHub", value: "github", detail: "Create or sign in with GitHub using your browser." },
      { label: "Continue with Google", value: "google", detail: "Create or sign in with Google using your browser." }
    ],
    {
      title: "Create a Magnexis account",
      ignoreFocusOut: true
    }
  );

  if (!method) {
    return undefined;
  }
  if (method.value === "github" || method.value === "google") {
    return { oauthProvider: method.value };
  }

  const email = await vscode.window.showInputBox({
    title: "Email address",
    prompt: "Enter the email address to register.",
    ignoreFocusOut: true
  });
  if (!email) {
    return undefined;
  }
  const password = await vscode.window.showInputBox({
    title: "Create a password",
    prompt: "Use a strong password. It is sent directly to Supabase and never stored locally.",
    password: true,
    ignoreFocusOut: true
  });
  if (!password) {
    return undefined;
  }
  return { email: email.trim(), password };
}

function authProgressTitle(action: string): string {
  switch (action) {
    case "sign-in":
      return "Signing in to Magnexis";
    case "sign-up":
      return "Creating your Magnexis account";
    case "sign-out":
      return "Signing out of Magnexis";
    case "refresh-session":
      return "Refreshing Magnexis session";
    default:
      return "Checking Magnexis account";
  }
}
