# Development

## Commands

```powershell
npm install
npm run compile
npm run preview:desktop
npm run preview:extension
npm run preview:web
npm run desktop
npm run package
npm run auth:check
```

Use `npm.cmd` in PowerShell environments that block script shims.

## Verification

- `npm run compile` type-checks the extension and desktop packages.
- `python workspaces/runtime/capture-desktop-preview.py` tests desktop interactions and screenshots.
- `python workspaces/runtime/capture-screenshots.py` exercises the extension browser harness.
- `npm run package` creates `magnexis-agent-studio-0.3.0.vsix`.
- `npm run auth:check` validates `.env` values required for Supabase Auth, localhost callback capture, and future native deep-link support.

Browser previews are useful for responsive layout checks but do not emulate VS Code APIs, SecretStorage, Electron `safeStorage`, or native `WebContentsView` behavior.

## Auth Setup

Create a local `.env` from `.env.example` before testing sign-in:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
AUTH_CALLBACK_URL=http://localhost:54321/auth/callback
AUTH_CALLBACK_PORT=54321
APP_DEEP_LINK_SCHEME=magnexis
```

Configure Supabase redirect URLs for:

- `http://localhost:54321/auth/callback`
- `magnexis://auth/callback`

## Conventions

- Keep TypeScript strict.
- Put shared provider and model facts in `@magnexis/llm-router`.
- Put serializable tool manifests in `@magnexis/tools`.
- Keep secrets out of shared state and test fixtures.
- Preserve manual approval as the default.
- Use small modules and existing local patterns.
- Update README and relevant docs when behavior or commands change.
