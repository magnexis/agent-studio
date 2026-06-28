const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const aliases = {
  "@magnexis/agent-core": "packages/agent-core/src/index.ts",
  "@magnexis/config": "packages/config/src/index.ts",
  "@magnexis/indexer": "packages/indexer/src/index.ts",
  "@magnexis/llm-router": "packages/llm-router/src/index.ts",
  "@magnexis/tools": "packages/tools/src/index.ts",
  "@magnexis/types": "packages/types/src/index.ts"
};
const cache = new Map();

function loadTypeScript(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (cache.has(resolvedPath)) return cache.get(resolvedPath).exports;

  const moduleRecord = { exports: {} };
  cache.set(resolvedPath, moduleRecord);
  const source = fs.readFileSync(resolvedPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: resolvedPath
  }).outputText;

  function localRequire(specifier) {
    if (aliases[specifier]) return loadTypeScript(path.join(root, aliases[specifier]));
    if (specifier.startsWith(".")) {
      const localPath = path.resolve(path.dirname(resolvedPath), specifier);
      return loadTypeScript(path.extname(localPath) ? localPath : `${localPath}.ts`);
    }
    return require(specifier);
  }

  const evaluate = new Function("require", "module", "exports", "__filename", "__dirname", output);
  evaluate(localRequire, moduleRecord, moduleRecord.exports, resolvedPath, path.dirname(resolvedPath));
  return moduleRecord.exports;
}

const desktop = loadTypeScript(path.join(root, "apps/desktop/src/index.ts"));
const html = desktop.renderDesktopHome(desktop.createDesktopShellState(root));
const outputPath = path.join(root, "workspaces/runtime/previews/magnexis-desktop-provider-workbench.html");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
console.log(outputPath);
