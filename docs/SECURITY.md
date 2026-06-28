# Security

Magnexis is local-first and approval-first. Security boundaries are product behavior, not decorative warnings.

## Secrets

- VS Code provider keys use `SecretStorage`.
- Desktop provider keys use Electron `safeStorage`.
- VS Code auth sessions also use `SecretStorage`.
- Desktop auth sessions are encrypted with Electron `safeStorage`.
- Raw keys must not be written to config, SQLite, logs, exports, screenshots, or source control.
- Replacing or deleting a key must happen through the owning secure-storage API.
- Service-role keys must never be used in the extension or desktop client. Only Supabase publishable or anon client keys belong here.

## Authentication

- OAuth opens the system browser. Magnexis does not embed provider login pages in a webview.
- Development callbacks use `http://localhost:54321/auth/callback` by default.
- Callback state is validated before exchanging the code for a session.
- Supabase PKCE code exchange happens locally after the callback reaches the temporary localhost server.
- The callback server exists only while a sign-in flow is active and shuts down on success, failure, or timeout.
- Raw passwords, authorization codes, access tokens, and refresh tokens must never be logged.

## Tool Policy

- Read-only workspace inspection can run without prompting in Agent mode.
- File mutation, terminal execution, package installation, browser control, network tools, and MCP/custom manifests require approval by default.
- Registration records metadata and policy state. It does not automatically execute or trust a package.
- Full Access must remain explicit, visible, and scoped to trusted workspaces.

## Sensitive Paths

Changes to environment files, package manifests, lockfiles, containers, CI workflows, authentication, APIs, payments, and billing require explicit confirmation. Deletion and broad multi-file changes require elevated review.

## External Content

Model Stats uses a sandboxed Electron `WebContentsView`. Navigation is restricted to HTTPS pages on `llm-stats.com`; permissions and popups are denied. No provider key, prompt, repository file, or workspace context is injected into the page.

## Reporting

Do not include secrets or private source in issue reports. Exported run logs should be reviewed before sharing because they may contain prompts, paths, diffs, and terminal output.
