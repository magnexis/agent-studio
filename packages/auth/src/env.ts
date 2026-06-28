import * as fs from "node:fs";
import * as path from "node:path";
import type { AuthEnvironment } from "./types";

export interface LoadAuthEnvironmentOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function loadAuthEnvironment(options: LoadAuthEnvironmentOptions = {}): AuthEnvironment {
  const cwd = options.cwd ?? process.cwd();
  const env = {
    ...readDotEnv(path.join(cwd, ".env")),
    ...readDotEnv(path.join(cwd, ".env.local")),
    ...options.env
  };

  return {
    SUPABASE_URL: String(env.SUPABASE_URL ?? "").trim(),
    SUPABASE_ANON_KEY: String(env.SUPABASE_ANON_KEY ?? "").trim(),
    AUTH_CALLBACK_URL: String(env.AUTH_CALLBACK_URL ?? "http://localhost:54321/auth/callback").trim(),
    AUTH_CALLBACK_PORT: parsePort(env.AUTH_CALLBACK_PORT),
    APP_DEEP_LINK_SCHEME: String(env.APP_DEEP_LINK_SCHEME ?? "magnexis").trim() || "magnexis"
  };
}

export function validateAuthEnvironment(environment: AuthEnvironment): string[] {
  const problems: string[] = [];
  if (!environment.SUPABASE_URL) {
    problems.push("SUPABASE_URL is missing.");
  }
  if (!environment.SUPABASE_ANON_KEY) {
    problems.push("SUPABASE_ANON_KEY is missing.");
  }
  if (!environment.AUTH_CALLBACK_URL) {
    problems.push("AUTH_CALLBACK_URL is missing.");
  }
  if (!Number.isInteger(environment.AUTH_CALLBACK_PORT) || environment.AUTH_CALLBACK_PORT < 1 || environment.AUTH_CALLBACK_PORT > 65535) {
    problems.push("AUTH_CALLBACK_PORT must be a valid TCP port.");
  }
  try {
    const callbackUrl = new URL(environment.AUTH_CALLBACK_URL);
    if (callbackUrl.hostname !== "localhost" && callbackUrl.hostname !== "127.0.0.1") {
      problems.push("AUTH_CALLBACK_URL should point to localhost during development.");
    }
  } catch {
    problems.push("AUTH_CALLBACK_URL must be a valid URL.");
  }
  return problems;
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(String(value ?? "54321"), 10);
  return Number.isFinite(parsed) ? parsed : 54321;
}

function readDotEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}
