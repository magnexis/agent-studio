# Changelog

All notable changes to Magnexis Agent Studio will be documented here.

## 0.4.0 - 2026-06-28

### Added

- VS Code `Pin Chat Near Editor` command and in-surface pin affordance for opening Agent Lab beside active code.
- richer README with real web and VS Code preview screenshots.
- release bundle assembly under `dist/releases/`.
- root `CONTRIBUTING.md` and `SECURITY.md`.
- versioned release notes and changelog scaffolding.

### Improved

- web dashboard branding now uses the real Magnexis mark.
- provider and model dropdowns in the web workspace now show provider logos.
- README now documents auth, release workflow, surfaces, and provider coverage in much more detail.
- VSIX packaging excludes local desktop state, `.env`, and debug logs.
- `.gitignore` now reflects actual local dev, preview, and packaging behavior.

### Fixed

- corrected web dropdown selected-state behavior so the chosen option matches the visible state.
- removed noisy preview logging from the extension preview script.
- cleaned release packaging so local secrets and runtime state are not included in the VSIX.

### Release Artifacts

- `magnexis-agent-studio-0.4.0.vsix`
- `dist/releases/magnexis-agent-studio-0.4.0/`
- `dist/releases/magnexis-agent-studio-0.4.0.zip`

### Known Gaps

- no automated GitHub Releases publishing from this repo alone
- no VS Code Marketplace publish flow from local packaging alone
- no native signed desktop installer pipeline yet
