const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
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

const dashboard = loadTypeScript(path.join(root, "apps/web-dashboard/src/index.ts"));
const html = dashboard.renderDashboardPage(root);
const outputPath = path.join(root, "workspaces/runtime/previews/magnexis-web-dashboard.html");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
console.log(outputPath);
