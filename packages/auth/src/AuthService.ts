import { randomBytes } from "node:crypto";
import { CallbackServer } from "./CallbackServer";
import type { AuthBrowserOpener, AuthCallbackPayload, AuthProvider, AuthSession, AuthSignInInput, AuthSignUpInput, AuthStatus, AuthUser } from "./types";

export interface AuthServiceOptions {
  provider: AuthProvider;
  browserOpener: AuthBrowserOpener;
  callbackUrl: string;
  callbackPort: number;
  callbackTimeoutMs?: number;
}

export class AuthService {
  constructor(private readonly options: AuthServiceOptions) {}

  async signIn(input: AuthSignInInput): Promise<AuthSession | null> {
    if (input.oauthProvider) {
      return this.signInWithOAuth(input.oauthProvider);
    }

    if (!input.email || !input.password) {
      throw new Error("Email and password are required to sign in.");
    }
    return this.options.provider.signInWithPassword(input.email, input.password);
  }

  async signUp(input: AuthSignUpInput): Promise<AuthSession | null> {
    return this.options.provider.signUpWithPassword(input.email, input.password);
  }

  async signOut(): Promise<void> {
    await this.options.provider.signOut();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  }

  async getSession(): Promise<AuthSession | null> {
    const session = await this.options.provider.getSession();
    if (!session) {
      return null;
    }

    if (isExpiring(session)) {
      return this.refreshSession();
    }
    return session;
  }

  async refreshSession(): Promise<AuthSession | null> {
    return this.options.provider.refreshSession();
  }

  async handleOAuthCallback(payload: AuthCallbackPayload): Promise<AuthSession> {
    if (payload.error) {
      throw new Error(payload.errorDescription ?? payload.error);
    }
    if (!payload.code) {
      throw new Error("Authentication callback did not include an authorization code.");
    }
    return this.options.provider.exchangeOAuthCode(payload.code);
  }

  async isAuthenticated(): Promise<boolean> {
    return Boolean(await this.getSession());
  }

  async getStatus(): Promise<AuthStatus> {
    const session = await this.getSession();
    return {
      authenticated: Boolean(session),
      provider: this.options.provider.id,
      user: session?.user ?? null,
      expiresAt: session?.expiresAt
    };
  }

  private async signInWithOAuth(oauthProvider: "github" | "google"): Promise<AuthSession> {
    const callbackTarget = new URL(this.options.callbackUrl);
    const state = randomBytes(24).toString("hex");
    const server = new CallbackServer({
      port: this.options.callbackPort,
      path: callbackTarget.pathname,
      expectedState: state,
      timeoutMs: this.options.callbackTimeoutMs
    });

    await server.start();
    try {
      const authorizationUrl = await this.options.provider.startOAuthSignIn(oauthProvider, this.options.callbackUrl, state);
      await this.options.browserOpener.open(authorizationUrl);
      const callback = await server.waitForCallback();
      return this.handleOAuthCallback(callback);
    } catch (error) {
      await server.stop();
      throw error;
    }
  }
}

function isExpiring(session: AuthSession): boolean {
  if (!session.expiresAt) {
    return false;
  }
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return session.expiresAt <= nowInSeconds + 60;
}
