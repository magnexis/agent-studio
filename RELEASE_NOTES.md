# Magnexis Agent Studio 0.4.0 Release Notes

Magnexis Agent Studio `0.4.0` is a release-prep build focused on product cohesion, packaging cleanup, and a much more complete developer-facing surface across web, desktop, extension, and docs.

## Highlights

- new VS Code pin workflow:
  - `Magnexis: Pin Chat Near Editor`
  - visible pin action in the Agent Lab header
  - cleaner split-editor behavior for keeping chat next to code
- richer project README with real UI previews
- release bundle generation for docs, screenshots, previews, and VSIX
- improved web workspace branding and provider/model dropdown treatment

## Surface Updates

### VS Code Extension

- clearer “pin near editor” action in the extension UI
- dedicated command palette command for pinning chat beside code
- sidebar title actions now expose the pinning workflow more explicitly

### Web Workspace

- real Magnexis branding in the sidebar
- provider logos in selected dropdown values and option lists
- tighter route selection and inspector presentation

### Desktop

- included in the release bundle and preview packaging flow
- continues to support isolated `llm-stats.com` embedding from the native runtime

## Packaging and Repo Hygiene

- VSIX packaging now excludes:
  - `.env`
  - debug logs
  - local desktop state
- `.gitignore` now reflects actual generated and local-only outputs
- `CONTRIBUTING.md`, `SECURITY.md`, and `CHANGELOG.md` added for release readiness

## Artifacts

- VSIX: `magnexis-agent-studio-0.4.0.vsix`
- bundle folder: `dist/releases/magnexis-agent-studio-0.4.0/`
- zipped bundle: `dist/releases/magnexis-agent-studio-0.4.0.zip`

## Still Not Automated

- GitHub Releases publishing
- VS Code Marketplace publishing
- signed native desktop installers
- hosted update manifests

Those still require authenticated release infrastructure outside this repo.
