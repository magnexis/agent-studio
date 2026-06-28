import * as http from "node:http";
import type { AddressInfo } from "node:net";
import type { AuthCallbackPayload } from "./types";

export interface CallbackServerOptions {
  port: number;
  path: string;
  expectedState: string;
  timeoutMs?: number;
}

export class CallbackServer {
  private readonly server = http.createServer(this.handleRequest.bind(this));
  private readonly timeoutMs: number;
  private readonly path: string;
  private readonly port: number;
  private readonly expectedState: string;
  private timeoutHandle?: NodeJS.Timeout;
  private settled = false;
  private resolveCallback?: (payload: AuthCallbackPayload) => void;
  private rejectCallback?: (error: Error) => void;
  private pending = new Promise<AuthCallbackPayload>((resolve, reject) => {
    this.resolveCallback = resolve;
    this.rejectCallback = reject;
  });

  constructor(options: CallbackServerOptions) {
    this.port = options.port;
    this.path = normalizePath(options.path);
    this.expectedState = options.expectedState;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        this.server.off("listening", onListening);
        reject(this.toListenError(error));
      };
      const onListening = () => {
        this.server.off("error", onError);
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.port, "127.0.0.1");
    });

    this.timeoutHandle = setTimeout(() => {
      this.fail(new Error(`Authentication timed out after ${Math.round(this.timeoutMs / 1000)} seconds.`));
    }, this.timeoutMs);
  }

  async waitForCallback(): Promise<AuthCallbackPayload> {
    return this.pending.finally(async () => {
      await this.stop();
    });
  }

  async stop(): Promise<void> {
    await this.close();
  }

  get listeningPort(): number {
    const address = this.server.address() as AddressInfo | null;
    return address?.port ?? this.port;
  }

  private async close(): Promise<void> {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
    if (!this.server.listening) {
      return;
    }
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private handleRequest(request: http.IncomingMessage, response: http.ServerResponse): void {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${this.port}`);
    if (request.method !== "GET" || requestUrl.pathname !== this.path) {
      this.writePage(response, 404, "Request not recognized", "This callback endpoint is only active during sign-in.");
      return;
    }

    const state = requestUrl.searchParams.get("state") ?? undefined;
    if (!state || state !== this.expectedState) {
      this.writePage(response, 400, "Authentication could not be verified", "The returned state token did not match this sign-in request. Please try again.");
      this.fail(new Error("Authentication callback state mismatch."));
      return;
    }

    const error = requestUrl.searchParams.get("error") ?? undefined;
    const errorDescription = requestUrl.searchParams.get("error_description")
      ?? requestUrl.searchParams.get("errorDescription")
      ?? undefined;
    const code = requestUrl.searchParams.get("code") ?? undefined;

    if (error) {
      this.writePage(response, 400, "Authentication was not completed", errorDescription ?? "The sign-in provider returned an error.");
      this.fail(new Error(errorDescription ?? `Authentication failed: ${error}`));
      return;
    }

    if (!code) {
      this.writePage(response, 400, "Authentication code missing", "The provider redirected back without an authorization code.");
      this.fail(new Error("Authentication callback did not include an authorization code."));
      return;
    }

    this.writePage(response, 200, "Sign-in complete", "You can close this browser tab and return to Magnexis Agent Studio.");
    this.succeed({
      code,
      state,
      rawUrl: requestUrl.toString()
    });
  }

  private succeed(payload: AuthCallbackPayload): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.resolveCallback?.(payload);
  }

  private fail(error: Error): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.rejectCallback?.(error);
  }

  private writePage(response: http.ServerResponse, statusCode: number, title: string, message: string): void {
    response.writeHead(statusCode, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050505; color: #f5f7fa; font-family: Inter, "Segoe UI", system-ui, sans-serif; }
    main { width: min(520px, calc(100vw - 32px)); padding: 28px; border: 1px solid #232323; border-radius: 14px; background: #0c0c0c; box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45); }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0; color: #b4bcc7; line-height: 1.55; }
    .badge { display: inline-flex; margin-bottom: 14px; padding: 6px 10px; border: 1px solid #323232; border-radius: 999px; background: #121212; color: #ffffff; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <div class="badge">Magnexis Authentication</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`);
  }

  private toListenError(error: NodeJS.ErrnoException): Error {
    if (error.code === "EADDRINUSE") {
      return new Error(`Authentication callback port ${this.port} is already in use. Update AUTH_CALLBACK_PORT or close the process using that port.`);
    }
    return error;
  }
}

function normalizePath(value: string): string {
  if (!value.startsWith("/")) {
    return `/${value}`;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}
