# Magnexis Agent Studio 0.4.2 Release Notes

Magnexis Agent Studio `0.4.2` is a security and correctness release that patches four bugs discovered during an automated audit of the extension host, indexer, and provider configuration code paths.

## Highlights

- closed a path-traversal bypass in `resolveWorkspacePath` that could allow workspace tool commands to access files outside the project root.
- fixed three instances of `limitBytes` that could silently return empty strings when byte budgets were small relative to multi-byte character content.
- corrected `shouldIgnorePath` in the indexer so ignore rules match path segments instead of arbitrary substrings (e.g. `dist` no longer filters out `distribute.ts`).

## Security

- `resolveWorkspacePath` now splits the normalized path on `/` and rejects any segment equal to `..`, covering cases like `foo/..` that the previous `includes("../")` string check missed.

## Bug Fixes

- `limitBytes` in `src/tools.ts`, `src/workspaceContext.ts`, and `src/instructions.ts` now clamps `end` to at least 1 before slicing, preventing the function from returning an empty string when the truncation loop overshoots.
- `shouldIgnorePath` in `packages/indexer/src/index.ts` now compares ignore entries against individual path segments rather than the full normalized path string, eliminating false-positive matches on filenames that contain an ignore token as a substring.

## Artifacts

- VSIX: `magnexis-agent-studio-0.4.2.vsix`
- bundle folder: `dist/releases/magnexis-agent-studio-0.4.2/`
- zipped bundle: `dist/releases/magnexis-agent-studio-0.4.2.zip`