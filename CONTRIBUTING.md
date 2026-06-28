# Contributing

Thanks for helping shape Magnexis Agent Studio.

## Ground Rules

- Keep Magnexis original. Do not copy product code, branding, or proprietary UX from other tools.
- Treat Magnexis as a connector and agent workbench, not as an LLM provider.
- Prefer small, reviewable changes over broad refactors.
- Preserve approval-first behavior for file edits, commands, and sensitive actions.

## Local Setup

```powershell
npm install
npm run compile
```

Useful entry points:

```powershell
npm run start:extension
npm run start:desktop
npm run start:web
npm run start:cli
```

Browser previews:

```powershell
npm run preview:extension
npm run preview:desktop
npm run preview:web
```

## Auth Setup

Copy `.env.example` to `.env`, then configure:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `AUTH_CALLBACK_URL`
- `AUTH_CALLBACK_PORT`
- `APP_DEEP_LINK_SCHEME`

Optional update-source configuration:

- `MAGNEXIS_GITHUB_RELEASES_URL`
- `MAGNEXIS_VSCODE_MARKETPLACE_URL`
- `MAGNEXIS_DESKTOP_MANIFEST_URL`
- `MAGNEXIS_UPDATE_MANIFEST_URL`

Validate auth configuration:

```powershell
npm run auth:check
```

## Code and UI Expectations

- Keep the surfaces visually aligned across desktop, extension, and web.
- Reuse shared tokens, badges, dropdown language, and provider metadata where possible.
- Avoid fake controls. If a button exists, it should work or clearly communicate its current state.
- Use strict TypeScript and keep user-facing strings polished.

## Verification

Before opening a PR or handing off a change:

```powershell
npm run compile
npm run preview:extension
npm run preview:desktop
npm run preview:web
```

When preparing a release bundle:

```powershell
npm run package
npm run release:bundle
```

## Release Notes

- Update versions consistently across root, apps, packages, and docs.
- Keep README, SECURITY, and setup instructions in sync with actual scripts.
- Do not claim marketplace, GitHub Release, or desktop-store publication unless it has actually happened.
