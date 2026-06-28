# Architecture

Magnexis Agent Studio is a TypeScript monorepo with one shared behavioral core and two primary product surfaces.

## Surfaces

- `src/` implements the VS Code extension host, webview, provider calls, tools, thread state, and approval flow.
- `apps/desktop/` implements the Electron workbench and native bridges for encrypted secrets, provider probing, window controls, and the isolated Model Stats view.
- `packages/` contains portable contracts for providers, routing, configuration, indexing, workflows, tools, authentication, and UI metadata.

The desktop and extension may render differently, but provider metadata, model limits, tool descriptors, and safety policy should live in shared packages whenever possible.

## Request Flow

1. The user selects a provider and model.
2. Magnexis gathers only the context explicitly selected or allowed by settings.
3. The router applies the local model budget.
4. The provider client streams a response under the user's key.
5. Read-only tools may execute according to policy.
6. Mutating tools create an approval request.
7. Approved edits are shown as diffs and applied through workspace APIs.

## Native Boundary

The Electron renderer receives a narrow preload bridge. It cannot access Node directly. Provider keys are encrypted in the main process. External Model Stats content runs in a sandboxed `WebContentsView`, has no preload or Node integration, and is restricted to `llm-stats.com` navigation.

## Authentication Boundary

`@magnexis/auth` owns the provider-agnostic auth service, callback server, env validation, and Supabase implementation. The VS Code extension instantiates it with `SecretStorage` and `vscode.env.openExternal`; Electron instantiates the same core in the main process with `safeStorage` and `shell.openExternal`.

## Shared Contracts

- `@magnexis/types`: provider, model, tool, context, workflow, and runtime-limit types.
- `@magnexis/llm-router`: provider presets, verified model metadata, routing, and endpoint probing.
- `@magnexis/config`: local/global config normalization and model-limit persistence.
- `@magnexis/tools`: built-in and installable tool manifests.
- `@magnexis/agent-core`: prompts, workflows, and task behavior.

Avoid copying catalogs into UI files. Add metadata to the shared router and derive surface-specific presentation from it.
