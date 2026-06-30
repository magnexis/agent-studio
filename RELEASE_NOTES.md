# Magnexis Agent Studio 0.4.1 Release Notes

Magnexis Agent Studio `0.4.1` is a stabilization release focused on extension install reliability, tighter VSIX packaging, and release metadata cleanup.

## Highlights

- fixed a packaging regression that prevented the installed VSIX from activating in VS Code because runtime dependencies were missing.
- tightened the shipped dependency set so the VSIX includes only the runtime modules required by the extension host.
- cleaned up release metadata, artifact names, and install instructions for the new build.

## VS Code Extension

- VSIX installs now activate correctly because required runtime packages are included in the shipped extension bundle.
- provider connection test notifications now render clean success and failure text in VS Code.

## Packaging and Repo Hygiene

- VSIX packaging now allows only the exact runtime dependency packages the extension resolves at startup.
- local-only files such as `.env`, debug logs, preview state, and workspace sources remain excluded from the shipped extension.
- versioned docs and release metadata now match the packaged build.

## Artifacts

- VSIX: `magnexis-agent-studio-0.4.1.vsix`
- bundle folder: `dist/releases/magnexis-agent-studio-0.4.1/`
- zipped bundle: `dist/releases/magnexis-agent-studio-0.4.1.zip`

## Still Not Automated

- GitHub Releases publishing
- signed native desktop installers
- hosted update manifests

VS Code Marketplace publishing still requires authenticated credentials in the current environment.
