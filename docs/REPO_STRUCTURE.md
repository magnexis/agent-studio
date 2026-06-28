# Repo Structure

Magnexis Agent Studio is organized as one workspace with multiple user-facing surfaces sharing the same runtime contracts.

## Top-level map

```text
apps/
  desktop/           Electron shell and desktop UI renderer
  vscode-extension/  Extension app wrapper and package metadata
  web-dashboard/     Browser dashboard renderer

packages/
  agent-core/        Shared workflow and agent primitives
  auth/              Shared Supabase auth services
  config/            Magnexis config model
  indexer/           Workspace indexing primitives
  llm-router/        Provider catalog and model routing metadata
  shared/            Shared utilities
  tools/             Tool registry and descriptors
  types/             Shared types
  ui/                Shared design tokens and interaction CSS contracts

src/
  extension.ts       VS Code extension host runtime entry
  extension/         Status bar, commands, and protected command helpers
  webview.ts         Extension webview HTML
  settingsView.ts    VS Code settings surface
  cli.ts             Local CLI entry

media/
  main.css           VS Code webview styles
  main.js            VS Code webview controller
  providers/         Provider marks and icons

workspaces/runtime/
  render-*.cjs       Preview renderers for each surface
  serve-preview.cjs  Preview server
  capture-*.py       Screenshot helpers
  previews/          Generated preview HTML output
```

## Why `src/` still exists at the repo root

The VS Code extension host runtime currently lives in the root `src/` directory because the root `package.json` is the actual extension manifest consumed by VS Code and `vsce`.

That means:

- `apps/vscode-extension/` is the app wrapper and package-level home for the extension surface
- root `src/` is the extension runtime code that VS Code executes today
- `media/` is shared with that extension runtime for the webview UI

This is intentional for the current MVP so packaging stays simple and stable.

## Start commands

From the repo root:

```powershell
npm run start:extension
npm run start:desktop
npm run start:web
npm run start:cli
```

From individual app folders:

```powershell
cd apps/desktop
npm run start

cd apps/vscode-extension
npm run start

cd apps/web-dashboard
npm run start
```
