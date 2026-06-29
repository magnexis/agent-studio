const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
const releaseRoot = path.join(root, "dist", "releases", `magnexis-agent-studio-${version}`);
const previewRoot = path.join(root, "workspaces", "runtime", "previews");
const docsRoot = path.join(root, "docs");
const screenshotsRoot = path.join(root, "screenshots");
const vsixName = `magnexis-agent-studio-${version}.vsix`;
const vsixPath = path.join(root, vsixName);
const artifactsRoot = path.join(releaseRoot, "artifacts");
const nativeRoot = path.join(root, "dist", "native");

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function copyFileIfPresent(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) return false;
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function copyDirectory(sourceDir, targetDir, filter) {
  if (!fs.existsSync(sourceDir)) return;
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (filter && !filter(sourcePath, entry)) continue;
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, filter);
    } else {
      ensureDir(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function zipDirectoryWindows(sourceDir, zipPath) {
  if (process.platform !== "win32") {
    return false;
  }
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }
  childProcess.execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -LiteralPath '${sourceDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}'`
    ],
    { stdio: "ignore" }
  );
  return true;
}

function createCliArtifact() {
  const cliRoot = path.join(artifactsRoot, "cli", `magnexis-cli-${version}`);
  fs.rmSync(cliRoot, { recursive: true, force: true });
  ensureDir(cliRoot);

  const cliPackage = {
    name: "magnexis-cli",
    version,
    description: "Magnexis Agent Studio CLI for provider checks, doctor commands, and local runs.",
    license: packageJson.license,
    bin: {
      magnexis: "./bin/magnexis.js"
    },
    main: "./out/src/cli.js",
    engines: {
      node: ">=20"
    },
    dependencies: packageJson.dependencies,
    repository: packageJson.repository,
    homepage: packageJson.homepage,
    bugs: packageJson.bugs
  };

  writeText(path.join(cliRoot, "package.json"), `${JSON.stringify(cliPackage, null, 2)}\n`);
  writeText(
    path.join(cliRoot, "README.md"),
    `# Magnexis CLI\n\nVersion ${version}\n\nThis artifact contains the Magnexis CLI runtime.\n\n## Install locally\n\n\`\`\`powershell\nnpm install\nnpm link\nmagnexis status\n\`\`\`\n\n## Run without linking\n\n\`\`\`powershell\nnode bin/magnexis.js status\n\`\`\`\n`
  );
  copyFileIfPresent(path.join(root, "LICENSE"), path.join(cliRoot, "LICENSE"));
  copyFileIfPresent(path.join(root, "CHANGELOG.md"), path.join(cliRoot, "CHANGELOG.md"));
  copyFileIfPresent(path.join(root, "RELEASE_NOTES.md"), path.join(cliRoot, "RELEASE_NOTES.md"));
  copyDirectory(path.join(root, "bin"), path.join(cliRoot, "bin"));
  copyDirectory(path.join(root, "out"), path.join(cliRoot, "out"));
  copyFileIfPresent(path.join(root, ".env.example"), path.join(cliRoot, ".env.example"));

  const cacheDir = path.join(artifactsRoot, "_tmp", "cli-npm-cache");
  ensureDir(cacheDir);
  const packCommand = process.platform === "win32"
    ? `npm.cmd pack --cache "${cacheDir}"`
    : `npm pack --cache "${cacheDir}"`;
  const packOutput = childProcess.execSync(packCommand, {
    cwd: cliRoot,
    encoding: "utf8"
  }).trim().split(/\r?\n/).pop();

  fs.rmSync(path.join(cliRoot, ".npm-cache"), { recursive: true, force: true });

  return {
    directory: cliRoot,
    tarball: packOutput ? path.join(cliRoot, packOutput) : null
  };
}

function createDesktopArtifact() {
  const desktopRoot = path.join(artifactsRoot, "desktop", `magnexis-desktop-${version}-source`);
  fs.rmSync(desktopRoot, { recursive: true, force: true });
  ensureDir(desktopRoot);

  const desktopPackage = {
    name: "magnexis-desktop",
    version,
    private: true,
    description: "Magnexis Agent Studio desktop source bundle.",
    main: "apps/desktop/electron/main.cjs",
    scripts: {
      start: "node workspaces/runtime/render-desktop-preview.cjs && electron apps/desktop/electron/main.cjs",
      preview: "node workspaces/runtime/render-desktop-preview.cjs && node workspaces/runtime/serve-preview.cjs desktop",
      typecheck: "tsc -p apps/desktop/tsconfig.json"
    },
    dependencies: {
      ...packageJson.dependencies,
      electron: packageJson.devDependencies.electron,
      typescript: packageJson.devDependencies.typescript
    }
  };

  writeText(path.join(desktopRoot, "package.json"), `${JSON.stringify(desktopPackage, null, 2)}\n`);
  writeText(
    path.join(desktopRoot, "README.md"),
    `# Magnexis Desktop Bundle\n\nVersion ${version}\n\nThis is the desktop source/runtime artifact for Magnexis Agent Studio.\n\n## Start the desktop app\n\n\`\`\`powershell\nnpm install\nnpm run start\n\`\`\`\n\n## Browser preview fallback\n\n\`\`\`powershell\nnpm run preview\n\`\`\`\n\nThis bundle does not include a signed native installer. It is the exact source/runtime handoff artifact produced by the current repository.\n`
  );
  writeText(
    path.join(desktopRoot, "start-desktop.cmd"),
    "@echo off\r\nnode workspaces\\runtime\\render-desktop-preview.cjs\r\ncall .\\node_modules\\.bin\\electron apps\\desktop\\electron\\main.cjs\r\n"
  );
  writeText(
    path.join(desktopRoot, "start-desktop.ps1"),
    "node workspaces/runtime/render-desktop-preview.cjs\n& ./node_modules/.bin/electron apps/desktop/electron/main.cjs\n"
  );

  copyFileIfPresent(path.join(root, "LICENSE"), path.join(desktopRoot, "LICENSE"));
  copyFileIfPresent(path.join(root, ".env.example"), path.join(desktopRoot, ".env.example"));
  copyFileIfPresent(path.join(root, "CHANGELOG.md"), path.join(desktopRoot, "CHANGELOG.md"));
  copyFileIfPresent(path.join(root, "RELEASE_NOTES.md"), path.join(desktopRoot, "RELEASE_NOTES.md"));
  copyFileIfPresent(path.join(root, "tsconfig.json"), path.join(desktopRoot, "tsconfig.json"));
  copyDirectory(path.join(root, "apps", "desktop"), path.join(desktopRoot, "apps", "desktop"));
  copyDirectory(path.join(root, "packages"), path.join(desktopRoot, "packages"));
  copyDirectory(path.join(root, "media"), path.join(desktopRoot, "media"), (_, entry) => entry.isDirectory() || /\.(png|svg|css|js)$/i.test(entry.name));
  copyDirectory(path.join(root, "workspaces", "runtime"), path.join(desktopRoot, "workspaces", "runtime"), (_, entry) => {
    return entry.isDirectory() || /\.(cjs|py)$/i.test(entry.name);
  });

  const zipPath = `${desktopRoot}.zip`;
  const zipped = zipDirectoryWindows(desktopRoot, zipPath);
  const nativeArtifacts = fs.existsSync(nativeRoot)
    ? fs.readdirSync(nativeRoot)
        .filter((name) => /\.(exe|dmg|appimage|deb|zip|blockmap|yml)$/i.test(name))
        .map((name) => path.join(nativeRoot, name))
    : [];
  return {
    directory: desktopRoot,
    zip: zipped ? zipPath : null,
    nativeArtifacts
  };
}

fs.rmSync(releaseRoot, { recursive: true, force: true });
ensureDir(releaseRoot);

const copied = {
  vsix: copyFileIfPresent(vsixPath, path.join(releaseRoot, vsixName)),
  readme: copyFileIfPresent(path.join(root, "README.md"), path.join(releaseRoot, "README.md")),
  changelog: copyFileIfPresent(path.join(root, "CHANGELOG.md"), path.join(releaseRoot, "CHANGELOG.md")),
  releaseNotes: copyFileIfPresent(path.join(root, "RELEASE_NOTES.md"), path.join(releaseRoot, "RELEASE_NOTES.md")),
  license: copyFileIfPresent(path.join(root, "LICENSE"), path.join(releaseRoot, "LICENSE")),
  contributing: copyFileIfPresent(path.join(root, "CONTRIBUTING.md"), path.join(releaseRoot, "CONTRIBUTING.md")),
  security: copyFileIfPresent(path.join(root, "SECURITY.md"), path.join(releaseRoot, "SECURITY.md"))
};

copyDirectory(docsRoot, path.join(releaseRoot, "docs"), (_, entry) => entry.isDirectory() || entry.name.endsWith(".md"));
copyDirectory(previewRoot, path.join(releaseRoot, "previews"), (_, entry) => entry.isDirectory() || entry.name.endsWith(".html"));
copyDirectory(path.join(root, "media"), path.join(releaseRoot, "media"), (_, entry) => {
  return entry.isDirectory() || /\.(png|svg|css|js)$/i.test(entry.name);
});
copyDirectory(screenshotsRoot, path.join(releaseRoot, "screenshots"), (_, entry) => {
  return entry.isDirectory() || /\.(png|jpg|jpeg|webp)$/i.test(entry.name);
});

const cliArtifact = createCliArtifact();
const desktopArtifact = createDesktopArtifact();

const manifest = {
  product: packageJson.name,
  displayName: packageJson.displayName,
  version,
  generatedAt: new Date().toISOString(),
  releaseDirectory: path.relative(root, releaseRoot),
  artifacts: {
    vsix: copied.vsix ? vsixName : null,
    changelog: copied.changelog,
    releaseNotes: copied.releaseNotes,
    cli: {
      directory: path.relative(root, cliArtifact.directory),
      tarball: cliArtifact.tarball ? path.relative(root, cliArtifact.tarball) : null
    },
    desktop: {
      directory: path.relative(root, desktopArtifact.directory),
      zip: desktopArtifact.zip ? path.relative(root, desktopArtifact.zip) : null,
      nativeArtifacts: desktopArtifact.nativeArtifacts.map((artifactPath) => path.relative(root, artifactPath))
    },
    previews: fs.existsSync(previewRoot),
    screenshots: fs.existsSync(screenshotsRoot),
    docs: fs.existsSync(docsRoot)
  },
  notes: [
    desktopArtifact.nativeArtifacts.length
      ? "Native desktop artifacts were detected and linked into this manifest."
      : "Desktop native installers are not generated by this repository yet; the desktop artifact is a source/runtime bundle.",
    "VS Code Marketplace publication, GitHub Releases, and desktop distribution still require authenticated publishing credentials.",
    "Use `npm run preview:desktop`, `npm run preview:extension`, and `npm run preview:web` to validate the packaged previews before publishing."
  ]
};

fs.writeFileSync(path.join(releaseRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(releaseRoot);
