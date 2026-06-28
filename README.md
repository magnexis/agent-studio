<p align="center">
  <img src="media/magnexis-icon.png" width="104" height="104" alt="Magnexis Agent Studio logo">
</p>

<h1 align="center">Magnexis Agent Studio</h1>

<p align="center">A local-first coding-agent workbench for VS Code and desktop.</p>

<p align="center">
  <img alt="Version 0.4.0" src="https://img.shields.io/badge/version-0.4.0-white?style=flat-square&labelColor=050505">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-white?style=flat-square&labelColor=050505">
  <img alt="Manual approval default" src="https://img.shields.io/badge/approval-manual%20by%20default-white?style=flat-square&labelColor=050505">
  <img alt="Local first" src="https://img.shields.io/badge/data-local--first-white?style=flat-square&labelColor=050505">
  <a href="CONTRIBUTING.md"><img alt="Contributing" src="https://img.shields.io/badge/contributing-guide-white?style=flat-square&labelColor=050505"></a>
  <a href="SECURITY.md"><img alt="Security" src="https://img.shields.io/badge/security-policy-white?style=flat-square&labelColor=050505"></a>
</p>

Magnexis is a connector, not an LLM provider. It hosts no model and includes no hidden inference service. It routes chat, repository context, and approved tool calls to a provider selected by the user under the user's credentials.

Version `0.4.0` includes the VS Code Agent Lab, an Electron desktop workbench, provider and model routing, verified model-context metadata, per-model budgets, safe tool registration, diff approval UI, and an integrated `llm-stats.com` research viewport.

## OpenAI Alignment

Where Magnexis talks to OpenAI directly, it now follows the official OpenAI developer pattern more closely:

- the Node package is `openai`
- the preferred OpenAI API path is the `Responses API`
- `OPENAI_API_KEY` is honored as the standard environment variable
- the CLI can explicitly choose `--api responses` or `--api chat-completions`

Magnexis still keeps its multi-provider catalog. For non-OpenAI routes, it preserves the existing OpenAI-compatible fallback path so local and third-party providers keep working.

## Highlights

- **19 provider presets:** OpenAI, Anthropic, Google Gemini, Z.ai, Mistral, Kimi, Groq, OpenRouter, Together AI, DeepSeek, xAI, Perplexity, Cerebras, Fireworks AI, SambaNova, NVIDIA NIM, Ollama, LM Studio, and custom OpenAI-compatible endpoints.
- **Verified model limits:** pinned first-party model metadata records context, output limit, source URL, and verification date. Gateway and local catalogs remain explicitly endpoint-reported.
- **Per-model guardrails:** local context, output, requests-per-minute, and tokens-per-minute caps can be set below provider limits.
- **Approval-first tools:** file edits, commands, browser sessions, GitHub access, MCP servers, and custom manifests remain gated by explicit approval.
- **Secure secrets:** VS Code uses `SecretStorage`; Electron uses the operating system credential encryption exposed by `safeStorage`.
- **Repository context:** current file, selected code, workspace maps, file mentions, persistent threads, and `AGENTS.md` instructions.
- **Reviewable edits:** proposed patches and terminal commands are visible before execution in Agent mode.
- **Integrated model research:** the desktop app hosts LLM Stats in an isolated `WebContentsView` restricted to `llm-stats.com`.

## Quick Start

Requirements: Node.js 20+, npm, VS Code 1.92+, and Python with Playwright only when regenerating screenshots.

```powershell
npm install
npm run compile
```

### Start Commands

Use these from the repo root:

```powershell
npm run start:extension
npm run start:desktop
npm run start:web
npm run start:cli
```

Surface-specific aliases also exist:

```powershell
npm run start:extension:preview
npm run start:desktop:preview
npm run start:web:preview
```

### Release Commands

```powershell
npm run package
npm run release:bundle
```

That produces the VSIX plus a local release folder under `dist/releases/magnexis-agent-studio-0.4.0/` with docs, previews, media assets, screenshots, and a `release-manifest.json`.

### CLI

Magnexis ships a local CLI entry point:

```powershell
npm run cli -- status
npm run cli -- doctor --workspace .
npm run cli -- providers openai
npm run cli -- run "Review this repository and summarize the main risks." --provider openai --api responses
```

After `npm link`, you can call it directly:

```powershell
magnexis status
magnexis run "Summarize this repo" --provider openai --api responses
```

For OpenAI itself, the CLI follows the official `openai` SDK style and uses the Responses API by default. For the broader Magnexis provider catalog, `chat-completions` remains available as the compatibility path.

### VS Code extension

1. Open this repository in VS Code.
2. Press `F5` and choose **Run Magnexis Agent Lab**.
3. In the Extension Development Host, run **Magnexis: Open Sidebar**.
4. Open the provider picker, select a provider and model, then save its API key.

Build and install the VSIX:

```powershell
npm run package
code --install-extension magnexis-agent-studio-0.4.0.vsix --force
```

### Desktop application

```powershell
npm run desktop
```

The native desktop window stores provider keys through Electron `safeStorage`. Open **Model Stats** to use the integrated LLM Stats viewport without leaving Magnexis.

## Authentication Setup

Magnexis now ships a shared Supabase-backed auth layer for the VS Code extension and the desktop app. It supports email/password sign-in, sign-up, OAuth with GitHub and Google when configured, localhost callback capture, secure session restore, and protected feature gating.

1. Copy `.env.example` to `.env`.
2. Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. In Supabase Auth, add these redirect URLs:
   `http://localhost:54321/auth/callback`
   `magnexis://auth/callback`
4. Keep using the localhost callback during development. The deep-link scheme is already reserved for a later native redirect path.

Auth environment example:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
AUTH_CALLBACK_URL=http://localhost:54321/auth/callback
AUTH_CALLBACK_PORT=54321
APP_DEEP_LINK_SCHEME=magnexis
```

Validation:

```powershell
npm run compile
npm run auth:check
```

### Update source placeholders

The update notification system currently uses mocked manifests in development and is ready to point at real release sources later. When your release pipeline exists, configure:

```env
MAGNEXIS_GITHUB_RELEASES_URL=
MAGNEXIS_VSCODE_MARKETPLACE_URL=
MAGNEXIS_DESKTOP_MANIFEST_URL=
MAGNEXIS_UPDATE_MANIFEST_URL=
```

Planned source roles:

- `MAGNEXIS_GITHUB_RELEASES_URL` for GitHub Releases
- `MAGNEXIS_VSCODE_MARKETPLACE_URL` for VS Code extension version checks
- `MAGNEXIS_DESKTOP_MANIFEST_URL` for native desktop package metadata
- `MAGNEXIS_UPDATE_MANIFEST_URL` for an internal Magnexis update manifest endpoint

### VS Code auth flow

- Run `Magnexis: Sign In`, `Magnexis: Sign Up`, `Magnexis: Sign Out`, `Magnexis: Show Account`, or `Magnexis: Refresh Session`.
- The status bar shows `Signed out` until a valid session is restored.
- OAuth opens your system browser and returns through the temporary localhost callback server.
- Sessions are stored in VS Code `SecretStorage`.

### Desktop auth flow

- Open **Settings > Account and sync**.
- Use **Sign in**, **Create account**, or the GitHub and Google browser flows.
- Sessions are stored in the desktop state store with Electron `safeStorage` encryption.
- The protected cloud workflow button is intentionally gated behind authentication.

### Browser previews

```powershell
npm run preview:desktop
npm run preview:extension
npm run preview:web
```

The preview servers print their URLs. Browser previews cannot host Electron's native `WebContentsView`, so Model Stats shows a truthful desktop-runtime fallback there.

## Safety Model

Manual approval is the default. Read-only inspection tools can run directly; workspace edits, shell commands, package installation, external browser control, and custom tool manifests require approval. Registering a tool records its manifest and policy state. It does not grant silent execution rights.

Provider keys never belong in `.magnexis/config.json`, Git, UI logs, or exported run logs. Full Access mode is intentionally explicit and should only be used in trusted workspaces.

Authentication uses Supabase PKCE and browser-based OAuth. Raw passwords, authorization codes, access tokens, refresh tokens, and service-role keys must never be logged or checked into the repository.

See [Security](docs/SECURITY.md) for trust boundaries and [Providers](docs/PROVIDERS.md) for model-metadata rules.

## Configuration

Project configuration lives in `.magnexis/config.json`; user-level defaults live in the user's `.magnexis/config.json`. VS Code settings use the `magnexis.*` namespace.

| Setting | Default | Purpose |
| --- | --- | --- |
| `magnexis.provider` | `zai` | Active external provider |
| `magnexis.model` | `glm-5.1` | Model identifier sent to that provider |
| `magnexis.approvalMode` | `agent` | `chat`, `agent`, or `fullAccess` |
| `magnexis.reasoningEffort` | `medium` | Requested planning effort |
| `magnexis.maxToolRounds` | `12` | Maximum model/tool turns |
| `magnexis.commandTimeoutMs` | `120000` | Terminal command timeout |
| `magnexis.autoContext` | `true` | Attach recent editor context |
| `magnexis.maxWorkspaceFiles` | `80` | Workspace-map path cap |
| `magnexis.maxFileBytes` | `24000` | Per-file context byte cap |

Per-model limits are stored under `modelLimits` in shared Magnexis configuration. They are local caps, not claims about account-level provider quotas.

## Troubleshooting

- Callback never returns:
  Make sure `AUTH_CALLBACK_PORT` is free and the redirect URL in Supabase exactly matches `AUTH_CALLBACK_URL`.
- OAuth provider mismatch:
  Confirm GitHub or Google is enabled in Supabase Auth and that the same provider is configured in the app command you used.
- Missing env variables:
  Run `npm run auth:check` after updating `.env`.
- Expired session:
  Use `Magnexis: Refresh Session` first. If refresh fails, sign in again.
- Browser cannot open:
  Check that the local machine allows `vscode.env.openExternal` or Electron `shell.openExternal` to launch the default browser.

## Monorepo

```text
apps/
  desktop/           Electron desktop workbench
  vscode-extension/  Extension app wrapper and package metadata
  web-dashboard/     Dashboard shell
packages/
  agent-core/  auth/  config/  indexer/
  llm-router/  shared/  tools/  types/  ui/
src/                 VS Code extension runtime host
media/               Shared UI, provider marks, and branding
workspaces/runtime/  Preview renderers, capture tools, and generated previews
```

Read [Architecture](docs/ARCHITECTURE.md), [Development](docs/DEVELOPMENT.md), [Providers](docs/PROVIDERS.md), and [Repo Structure](docs/REPO_STRUCTURE.md) before extending shared contracts.

See [Contributing](CONTRIBUTING.md) for contribution workflow and [Security](SECURITY.md) for reporting and trust-boundary guidance.

## Status

This is an active `0.4.0` development build. OpenAI-compatible providers are the most complete path. Native desktop installers, marketplace publication, GitHub Release automation, and signed distribution still require external publishing credentials and are not completed by this repository alone.

## License

Proprietary. See [LICENSE](LICENSE).
