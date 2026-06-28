export interface DesktopProviderInput {
  type: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface DesktopProviderTestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface DesktopProviderModelsResult {
  ok: boolean;
  message: string;
  models: string[];
}

export interface DesktopSettingsInput {
  approvalMode: "manual" | "semi-auto" | "full-auto" | "read-only";
  autoApply: boolean;
  autoRunCommands: boolean;
  persistHistory: boolean;
  modelLimits?: Record<string, { maxContextTokens: number; maxOutputTokens: number; requestsPerMinute: number; tokensPerMinute: number }>;
}

export interface DesktopAuthStatus {
  authenticated: boolean;
  provider: "supabase";
  user: {
    id: string;
    email?: string;
    username?: string;
    displayName?: string;
    provider?: string;
  } | null;
  expiresAt?: number;
}

export interface DesktopAuthInput {
  email?: string;
  password?: string;
  oauthProvider?: "github" | "google";
}

export interface DesktopRuntimeBridge {
  testProvider(input: DesktopProviderInput): Promise<DesktopProviderTestResult>;
  testConfiguredProvider(providerId: string): Promise<DesktopProviderTestResult>;
  listProviderModels(input: DesktopProviderInput): Promise<DesktopProviderModelsResult>;
  saveProvider(input: DesktopProviderInput): Promise<void>;
  saveSettings(input: DesktopSettingsInput): Promise<void>;
  getAuthStatus?(): Promise<DesktopAuthStatus>;
  signIn?(input: DesktopAuthInput): Promise<DesktopAuthStatus>;
  signUp?(input: DesktopAuthInput): Promise<DesktopAuthStatus>;
  signOut?(): Promise<void>;
  refreshAuthSession?(): Promise<DesktopAuthStatus>;
  runProtectedAction?(): Promise<{ ok: boolean; message: string }>;
  listToolStates?(): Promise<Record<string, { enabled?: boolean }>>;
  setToolState?(input: { id: string; enabled: boolean; source?: string }): Promise<void>;
  registerTool?(input: { id: string; name: string; command: string }): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  windowAction(action: "minimize" | "maximize" | "close"): Promise<void>;
}

declare global {
  interface Window {
    magnexisDesktop?: DesktopRuntimeBridge;
  }
}
