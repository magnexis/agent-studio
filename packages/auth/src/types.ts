export type AuthProviderId = "supabase";

export type AuthOAuthProvider = "github" | "google";

export interface AuthEnvironment {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  AUTH_CALLBACK_URL: string;
  AUTH_CALLBACK_PORT: number;
  APP_DEEP_LINK_SCHEME: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
  provider?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  user: AuthUser;
}

export interface AuthStatus {
  authenticated: boolean;
  provider: AuthProviderId;
  user: AuthUser | null;
  expiresAt?: number;
}

export interface AuthCallbackPayload {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  rawUrl: string;
}

export interface AuthSignInInput {
  email?: string;
  password?: string;
  oauthProvider?: AuthOAuthProvider;
}

export interface AuthSignUpInput {
  email: string;
  password: string;
}

export interface AuthBrowserOpener {
  open(url: string): Promise<void>;
}

export interface AuthProvider {
  readonly id: AuthProviderId;
  signInWithPassword(email: string, password: string): Promise<AuthSession>;
  signUpWithPassword(email: string, password: string): Promise<AuthSession | null>;
  startOAuthSignIn(provider: AuthOAuthProvider, redirectTo: string, state: string): Promise<string>;
  exchangeOAuthCode(code: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<AuthUser | null>;
  refreshSession(): Promise<AuthSession | null>;
}
