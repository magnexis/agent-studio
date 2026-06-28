const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const requestedMode = process.argv[2];
const mode = requestedMode === "extension" || requestedMode === "web" ? requestedMode : "desktop";
const preferredPort = Number(process.env.PORT || (mode === "extension" ? 4174 : mode === "web" ? 4175 : 4173));
const maxPortAttempts = 20;
const entryPath = mode === "extension"
  ? "/workspaces/runtime/previews/magnexis-vscode-sidebar.html"
  : mode === "web"
    ? "/workspaces/runtime/previews/magnexis-web-dashboard.html"
    : "/workspaces/runtime/previews/magnexis-desktop-provider-workbench.html";
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function createPreviewServer() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    const requestedPath = pathname === "/" ? entryPath : pathname;
    const filePath = path.resolve(root, `.${requestedPath}`);
    if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function listenOnPort(startPort, attemptsRemaining) {
  const nextPort = startPort;
  const server = createPreviewServer();
  const onError = (error) => {
    if (error && error.code === "EADDRINUSE" && attemptsRemaining > 0) {
      server.close();
      listenOnPort(nextPort + 1, attemptsRemaining - 1);
      return;
    }

    throw error;
  };

  server.once("error", onError);
  server.listen(nextPort, "127.0.0.1", () => {
    server.off("error", onError);
    if (nextPort !== preferredPort) {
      console.log(`Preferred port ${preferredPort} was busy, using ${nextPort} instead.`);
    }
    console.log(`Magnexis ${mode} preview: http://127.0.0.1:${nextPort}${entryPath}`);
    console.log("Press Ctrl+C to stop.");
  });
}

listenOnPort(preferredPort, maxPortAttempts);
