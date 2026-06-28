import { createClient, type Session, type User } from "@supabase/supabase-js";
import { SecureStorageAdapter, type SecureKeyValueStore } from "./SessionStorage";
import type { AuthOAuthProvider, AuthProvider, AuthSession, AuthUser } from "./types";

export interface SupabaseAuthProviderOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  secureStore: SecureKeyValueStore;
  storageKey?: string;
}

export class SupabaseAuthProvider implements AuthProvider {
  readonly id = "supabase" as const;
  private readonly client;

  constructor(options: SupabaseAuthProviderOptions) {
    this.client = createClient(options.supabaseUrl, options.supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: false,
        autoRefreshToken: false,
        flowType: "pkce",
        storageKey: options.storageKey ?? "magnexis-auth",
        storage: new SecureStorageAdapter(options.secureStore)
      }
    });
  }

  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session) {
      throw new Error("Supabase did not return a session for this sign-in.");
    }
    return toAuthSession(data.session);
  }

  async signUpWithPassword(email: string, password: string): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) {
      throw new Error(error.message);
    }
    return data.session ? toAuthSession(data.session) : null;
  }

  async startOAuthSignIn(provider: AuthOAuthProvider, redirectTo: string, state: string): Promise<string> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        scopes: provider === "github" ? "read:user user:email" : "openid email profile",
        queryParams: {
          state
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }
    if (!data.url) {
      throw new Error("Supabase did not return an authorization URL.");
    }
    return data.url;
  }

  async exchangeOAuthCode(code: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.exchangeCodeForSession(code);
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session) {
      throw new Error("Supabase did not return a session after the OAuth callback.");
    }
    return toAuthSession(data.session);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    return data.session ? toAuthSession(data.session) : null;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      throw new Error(error.message);
    }
    return data.user ? toAuthUser(data.user) : null;
  }

  async refreshSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.refreshSession();
    if (error) {
      throw new Error(error.message);
    }
    return data.session ? toAuthSession(data.session) : null;
  }
}

function toAuthSession(session: Session): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    tokenType: session.token_type,
    user: toAuthUser(session.user)
  };
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: typeof user.user_metadata?.user_name === "string"
      ? user.user_metadata.user_name
      : typeof user.user_metadata?.preferred_username === "string"
        ? user.user_metadata.preferred_username
        : undefined,
    displayName: typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : undefined,
    provider: typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : undefined
  };
}
