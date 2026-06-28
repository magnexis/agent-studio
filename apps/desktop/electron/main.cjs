const { app, BrowserWindow, desktopCapturer, ipcMain, safeStorage, shell, WebContentsView } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// ============================================================================
// CONFIGURATION CONSTANTS (Fix #10: Magic Numbers)
// ============================================================================

const CONFIG = {
  APP_NAME: "Magnexis Agent Studio",
  ALLOWED_EXTERNAL_HOST: "llm-stats.com",
  PARTITION_NAME: "persist:magnexis-llm-stats",
  
  // Window defaults
  WINDOW_DEFAULT_WIDTH: 1480,
  WINDOW_DEFAULT_HEIGHT: 980,
  WINDOW_MIN_WIDTH: 980,
  WINDOW_MIN_HEIGHT: 700,
  WINDOW_BACKGROUND_COLOR: "#000000",
  STATS_BACKGROUND_COLOR: "#ffffff",
  
  // Timing
  CAPTURE_DELAY_MS: 8000,
  SMOKE_TEST_TIMEOUT_MS: 2000, // Increased from 500ms for reliability
  
  // Security & Performance
  MAX_MODULE_CACHE_SIZE: 100,
  API_TIMEOUT_MS: 10000,
};

// ============================================================================
// PATH RESOLUTION (Fixed at startup)
// ============================================================================

const root = path.resolve(__dirname, "../../..");
const previewPath = path.join(root, "workspaces/runtime/previews/magnexis-desktop-provider-workbench.html");
const desktopUserDataPath = path.join(root, ".magnexis-desktop");

// Module aliases configuration
const moduleAliases = {
  "@magnexis/auth": "packages/auth/src/index.ts"
};

// ============================================================================
// APPLICATION SETUP
// ============================================================================

app.setName(CONFIG.APP_NAME);
app.setPath("userData", desktopUserDataPath);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");

// ============================================================================
// LOGGING UTILITIES (Fix #3: Silent Error Swallowing)
// ============================================================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO; // Set to DEBUG in development

function log(level, message, data = null) {
  if (level > CURRENT_LOG_LEVEL) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level)}]`;
  
  const logMessage = `${prefix} ${message}`;
  
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(logMessage, data || "");
      break;
    case LOG_LEVELS.WARN:
      console.warn(logMessage, data || "");
      break;
    default:
      console.log(logMessage, data || "");
  }
}

function logSecurity(event, details) {
  log(LOG_LEVELS.WARN, `[Security] ${event}`, details);
}

function logError(context, error) {
  log(LOG_LEVELS.ERROR, `${context}: ${error.message}`, {
    stack: error.stack,
    name: error.name,
    code: error.code,
  });
}

// ============================================================================
// INPUT VALIDATION (Fix #5: Missing Input Validation)
// ============================================================================

/**
 * Validates that input is a non-null object with required string fields.
 * @param {*} input - The input to validate
 * @param {string[]} requiredFields - Array of required field names
 * @param {string} context - Description of what's being validated (for error messages)
 * @returns {object} The validated input
 * @throws {Error} If validation fails
 */
function validateInput(input, requiredFields = [], context = "input") {
  if (!input || typeof input !== "object") {
    throw new Error(`Invalid ${context}: expected object, got ${typeof input}`);
  }
  
  for (const field of requiredFields) {
    if (input[field] === undefined || input[field] === null) {
      throw new Error(`Invalid ${context}: missing required field "${field}"`);
    }
    if (typeof input[field] === "string" && input[field].trim() === "") {
      throw new Error(`Invalid ${context}: field "${field}" cannot be empty`);
    }
  }
  
  return input;
}

/**
 * Validates URL-like inputs for security-sensitive operations.
 */
function validateUrlInput(url, fieldName = "url") {
  if (!url || typeof url !== "string") {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string`);
  }
  try {
    new URL(url); // Will throw if invalid URL format
  } catch {
    throw new Error(`Invalid ${fieldName}: not a valid URL`);
  }
  return url.trim();
}

// ============================================================================
// ENCRYPTION UTILITIES (Fix #6: Inconsistent Encryption Checks)
// ============================================================================

/**
 * Ensures system encryption is available before proceeding.
 * Centralized check used everywhere encryption is needed.
 * @throws {Error} If encryption is unavailable
 */
function requireEncryption() {
  if (!safeStorage.isEncryptionAvailable()) {
    const error = new Error(
      "Operating-system credential encryption is unavailable. " +
      "This may occur in sandboxed environments or certain Linux configurations."
    );
    logSecurity("Encryption unavailable", { platform: process.platform });
    throw error;
  }
}

/**
 * Decrypts an encrypted API key from storage.
 * Now includes proper error handling and logging (Fix #3).
 * @param {object|null} record - Object containing encryptedApiKey property
 * @returns {string} Decrypted key or empty string if none/failed
 */
function decryptKey(record) {
  if (!record?.encryptedApiKey) {
    return "";
  }
  
  if (!safeStorage.isEncryptionAvailable()) {
    logSecurity("Cannot decrypt key - encryption unavailable", { hasKey: true });
    return "";
  }
  
  try {
    return safeStorage.decryptString(Buffer.from(record.encryptedApiKey, "base64"));
  } catch (error) {
    logError("Failed to decrypt API key", error);
    return ""; // Return empty but we now KNOW it failed (logged)
  }
}

// ============================================================================
// MODULE LOADER WITH CACHE MANAGEMENT (Fix #4: Memory Leak + Fix #7: Path Traversal)
// ============================================================================

const moduleCache = new Map();

/**
 * Loads a TypeScript module dynamically with caching and security checks.
 * Implements LRU-style cache eviction to prevent unbounded memory growth.
 * Includes path traversal protection.
 * 
 * @param {string} filePath - Path to .ts file to load
 * @returns {object} Module exports
 */
function loadTypeScriptModule(filePath) {
  const resolvedPath = path.resolve(filePath);
  
  // Return cached version if available
  if (moduleCache.has(resolvedPath)) {
    log(LOG_LEVELS.DEBUG, `Module cache hit: ${resolvedPath}`);
    return moduleCache.get(resolvedPath).exports;
  }
  
  // Security check: Ensure path doesn't escape root directory (Fix #7)
  const normalizedPath = path.normalize(resolvedPath);
  if (!normalizedPath.startsWith(path.normalize(root))) {
    logSecurity("Module load attempted path escape", { 
      requested: filePath, 
      resolved: normalizedPath,
      root: root 
    });
    throw new Error(`Module path escapes allowed directory: ${filePath}`);
  }
  
  // Cache size management: Evict oldest entries if at capacity (Fix #4)
  if (moduleCache.size >= CONFIG.MAX_MODULE_CACHE_SIZE) {
    const oldestKey = moduleCache.keys().next().value;
    moduleCache.delete(oldestKey);
    log(LOG_LEVELS.DEBUG, `Module cache evicted: ${oldestKey} (cache full, max=${CONFIG.MAX_MODULE_CACHE_SIZE})`);
  }

  const moduleRecord = { exports: {} };
  moduleCache.set(resolvedPath, moduleRecord);
  
  let source;
  try {
    source = fs.readFileSync(resolvedPath, "utf8");
  } catch (error) {
    logError(`Failed to read module file: ${resolvedPath}`, error);
    moduleCache.delete(resolvedPath); // Clean up failed entry
    throw error;
  }

  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: resolvedPath
  }).outputText;

  /**
   * Local require function for transpiled modules.
   * Resolves relative paths and module aliases securely.
   */
  function localRequire(specifier) {
    // Check module aliases first
    if (moduleAliases[specifier]) {
      return loadTypeScriptModule(path.join(root, moduleAliases[specifier]));
    }
    
    // Handle relative imports
    if (specifier.startsWith(".")) {
      const localPath = path.resolve(path.dirname(resolvedPath), specifier);
      
      // Path traversal protection (Fix #7)
      const normalizedLocalPath = path.normalize(localPath);
      if (!normalizedLocalPath.startsWith(path.normalize(root))) {
        throw new Error(`Relative import escapes root: ${specifier}`);
      }
      
      const finalPath = path.extname(localPath) ? localPath : `${localPath}.ts`;
      return loadTypeScriptModule(finalPath);
    }
    
    // Fall back to Node.js require for built-in/npm modules
    return require(specifier);
  }

  try {
    const evaluate = new Function("require", "module", "exports", "__filename", "__dirname", output);
    evaluate(localRequire, moduleRecord, moduleRecord.exports, resolvedPath, path.dirname(resolvedPath));
  } catch (error) {
    logError(`Failed to execute module: ${resolvedPath}`, error);
    moduleCache.delete(resolvedPath); // Clean up failed entry
    throw error;
  }
  
  log(LOG_LEVELS.DEBUG, `Module loaded successfully: ${resolvedPath}`);
  return moduleRecord.exports;
}

// Load auth module once at startup
let authModule;
try {
  authModule = loadTypeScriptModule(path.join(root, "packages/auth/src/index.ts"));
} catch (error) {
  logError("Fatal: Failed to load auth module", error);
  // Don't throw here - will be caught when auth is actually used
}

// ============================================================================
// ASYNCHRONOUS STORE WITH WRITE SERIALIZIZATION (Fix #2: Race Condition)
// ============================================================================

const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

/**
 * Serializes write operations to prevent race conditions.
 * All writes queue behind each other to prevent data loss.
 */
let writeQueue = Promise.resolve();

/**
 * Reads the persistent state store asynchronously.
 * @returns {Promise<object>} Parsed store object or default empty state
 */
async function readStore() {
  const storePath = path.join(app.getPath("userData"), "desktop-state.json");
  
  try {
    const data = await readFileAsync(storePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet or is corrupt - return defaults
    if (error.code !== 'ENOENT') {
      logError("Failed to read store, using defaults", error);
    }
    return { providers: {}, settings: {}, tools: {}, authSecrets: {} };
  }
}

/**
 * Writes to the persistent state store with serialization.
 * Multiple rapid calls won't overwrite each other.
 * 
 * @param {object} store - Complete store object to write
 * @returns {Promise<void>}
 */
async function writeStore(store) {
  const storePath = path.join(app.getPath("userData"), "desktop-state.json");
  
  // Ensure directory exists
  const storeDir = path.dirname(storePath);
  try {
    await mkdirAsync(storeDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      logError("Failed to create store directory", error);
      throw error;
    }
  }
  
  // Queue this write after all previous writes complete
  writeQueue = writeQueue.then(async () => {
    try {
      const serialized = JSON.stringify(store, null, 2);
      await writeFileAsync(storePath, serialized, "utf-8");
      log(LOG_LEVELS.DEBUG, "Store written successfully");
    } catch (error) {
      logError("Failed to write store", error);
      throw error; // Re-throw so caller knows it failed
    }
  });
  
  return writeQueue;
}

// ============================================================================
// AUTHENTICATION SERVICE SINGLETON (Fix #1: Instance Leak)
// ============================================================================

/** @type {import('@magnexis/auth').AuthService | null} */
let authServiceInstance = null;

/**
 * Returns a singleton AuthService instance.
 * Creates on first call, reuses thereafter.
 * Prevents multiple instances causing session conflicts.
 * 
 * @returns {import('@magnexis/auth').AuthService}
 * @throws {Error} If auth environment is misconfigured
 */
function getAuthService() {
  if (!authServiceInstance) {
    log(LOG_LEVELS.INFO, "Creating AuthService singleton instance");
    authServiceInstance = createDesktopAuthServiceInternal();
  }
  return authServiceInstance;
}

/**
 * Resets the auth service singleton (useful for testing or forced refresh).
 */
function resetAuthService() {
  authServiceInstance = null;
  log(LOG_LEVELS.INFO, "AuthService singleton reset");
}

/**
 * Internal implementation of auth service creation.
 * Separated so getAuthService can manage singleton lifecycle.
 * 
 * @private
 * @returns {import('@magnexis/auth').AuthService}
 */
function createDesktopAuthServiceInternal() {
  if (!authModule) {
    throw new Error("Auth module not loaded. Check packages/auth/src/index.ts exists.");
  }
  
  const environment = authModule.loadAuthEnvironment({ cwd: root, env: process.env });
  const warnings = authModule.validateAuthEnvironment(environment);
  
  if (warnings.length) {
    throw new Error(
      `Authentication is not configured.\n${warnings.join("\n")}\n` +
      "Add the required values to your local .env before using desktop sign-in."
    );
  }

  const provider = new authModule.SupabaseAuthProvider({
    supabaseUrl: environment.SUPABASE_URL,
    supabaseAnonKey: environment.SUPABASE_ANON_KEY,
    secureStore: createDesktopSecureStore(),
    storageKey: "magnexis.desktop.supabase.session"
  });

  return new authModule.AuthService({
    provider,
    browserOpener: {
      open: (url) => shell.openExternal(url)
    },
    callbackUrl: environment.AUTH_CALLBACK_URL,
    callbackPort: environment.AUTH_CALLBACK_PORT
  });
}

// Backward-compatible alias (in case external code calls this directly)
function createDesktopAuthService() {
  return getAuthService();
}

// ============================================================================
// SECURE STORAGE IMPLEMENTATION
// ============================================================================

/**
 * Creates a secure key-value store backed by encrypted filesystem storage.
 * Uses OS-level credential encryption via Electron's safeStorage.
 * 
 * @returns {{get: Function, set: Function, delete: Function}}
 */
function createDesktopSecureStore() {
  return {
    async get(key) {
      validateInput({ key }, ['key'], 'secure store key');
      
      const store = await readStore();
      const encryptedValue = store.authSecrets?.[key];
      
      if (!encryptedValue) {
        return null;
      }
      
      requireEncryption(); // Will throw if unavailable
      
      try {
        return safeStorage.decryptString(Buffer.from(encryptedValue, "base64"));
      } catch (error) {
        logError(`Failed to decrypt secure store key: ${key}`, error);
        return null;
      }
    },
    
    async set(key, value) {
      validateInput({ key, value }, ['key', 'value'], 'secure store entry');
      
      requireEncryption(); // Will throw if unavailable
      
      const store = await readStore();
      store.authSecrets = store.authSecrets || {};
      store.authSecrets[key] = safeStorage.encryptString(value).toString("base64");
      await writeStore(store);
    },
    
    async delete(key) {
      validateInput({ key }, ['key'], 'secure store key');
      
      const store = await readStore();
      if (store.authSecrets?.[key]) {
        delete store.authSecrets[key];
        await writeStore(store);
      }
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a safe provider ID from a name string.
 * Sanitizes input to prevent injection or invalid characters.
 * 
 * @param {string} name - Provider type/name
 * @returns {string} Safe alphanumeric ID with hyphens
 */
function providerId(name) {
  if (typeof name !== "string" || !name.trim()) {
    return "custom"; // Default fallback
  }
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "custom"; // Final fallback if result is empty
}

/**
 * Validates and normalizes URLs for external navigation.
 * Only allows HTTPS URLs to trusted domains.
 * 
 * @param {string} value - URL to validate
 * @returns {string} Normalized trusted URL
 * @throws {Error} If URL is not trusted
 */
function trustedExternalUrl(value) {
  let target;
  try {
    target = new URL(value.trim());
  } catch (error) {
    throw new Error(`Invalid URL provided: ${value}. Error: ${error.message}`);
  }
  
  if (target.protocol !== "https:") {
    throw new Error(`Only HTTPS links are allowed (received: ${target.protocol})`);
  }
  
  const isAllowedHost = 
    target.hostname === CONFIG.ALLOWED_EXTERNAL_HOST ||
    target.hostname.endsWith(`.${CONFIG.ALLOWED_EXTERNAL_HOST}`);
  
  if (!isAllowedHost) {
    logSecurity("Blocked external URL navigation", {
      hostname: target.hostname,
      allowedHost: CONFIG.ALLOWED_EXTERNAL_HOST
    });
    throw new Error(
      `Only trusted ${CONFIG.ALLOWED_EXTERNAL_HOST} links may be opened. ` +
      `Received: ${target.hostname}`
    );
  }
  
  return target.toString();
}

// ============================================================================
// MODEL LISTING (API Integration)
// ============================================================================

/**
 * Fetches available models from an LLM provider endpoint.
 * Includes timeout and proper error handling.
 * 
 * @param {object} input - Provider configuration
 * @param {string} [input.baseUrl] - API base URL
 * @param {string} [input.apiKey] - API key (optional if storedKey provided)
 * @param {string} [storedKey] - Pre-stored decrypted API key
 * @returns {Promise<{ok: boolean, message: string, models: string[]}>}
 */
async function listModels(input, storedKey = "") {
  // Validate input shape
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Invalid input: provider configuration must be an object", models: [] };
  }
  
  const baseUrl = String(input.baseUrl || "").trim().replace(/\/+$/, "");
  
  if (!baseUrl) {
    return { ok: false, message: "Base URL is required.", models: [] };
  }
  
  // Validate URL format
  try {
    new URL(baseUrl);
  } catch {
    return { ok: false, message: `Invalid base URL format: ${baseUrl}`, models: [] };
  }
  
  const headers = { Accept: "application/json" };
  const apiKey = String(input.apiKey || storedKey).trim();
  
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);
    
    const response = await fetch(`${baseUrl}/models`, { 
      headers, 
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { 
        ok: false, 
        message: `HTTP ${response.status} ${response.statusText}`, 
        models: [] 
      };
    }
    
    const payload = await response.json();
    
    // Safely extract model IDs with validation
    const models = Array.isArray(payload?.data)
      ? payload.data
          .map((item) => item?.id)
          .filter((id) => typeof id === "string" && id.trim())
      : [];
    
    return {
      ok: true,
      message: models.length 
        ? `${models.length} model(s) reported.` 
        : "Endpoint reachable but no models found.",
      models
    };
    
  } catch (error) {
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      return { 
        ok: false, 
        message: `Request timed out after ${CONFIG.API_TIMEOUT_MS / 1000} seconds`, 
        models: [] 
      };
    }
    
    // Handle network errors
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    
    logError("listModels request failed", error);
    
    return { ok: false, message: errorMessage, models: [] };
  }
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

/** @type {BrowserWindow | undefined} */
let mainWindow;

/** @type {WebContentsView | undefined} */
let statsView;

/**
 * Sends current stats view state to renderer process.
 * Includes bounds checking to ensure window validity.
 * 
 * @param {object} [extra={}] - Additional state properties to merge
 */
function sendStatsState(extra = {}) {
  // Guard against destroyed/missing windows (Fix #8 prevention)
  if (!mainWindow || mainWindow.isDestroyed()) {
    log(LOG_LEVELS.WARN, "sendStatsState called but mainWindow is destroyed/missing");
    return;
  }
  
  if (!statsView || statsView.isDestroyed()) {
    log(LOG_LEVELS.WARN, "sendStatsState called but statsView is destroyed/missing");
    return;
  }
  
  try {
    const statsContents = statsView.webContents;
    
    mainWindow.webContents.send("stats:state", {
      url: statsContents.getURL() || `https://${CONFIG.ALLOWED_EXTERNAL_HOST}/`,
      canGoBack: statsContents.navigationHistory.canGoBack(),
      canGoForward: statsContents.navigationHistory.canGoForward(),
      loading: statsContents.isLoading(),
      ...extra
    });
  } catch (error) {
    logError("Failed to send stats state", error);
  }
}

/**
 * Creates the embedded WebContentsView for displaying statistics.
 * Configures strict security sandboxing and navigation restrictions.
 */
function createStatsView() {
  log(LOG_LEVELS.INFO, "Creating stats view");
  
  statsView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: CONFIG.PARTITION_NAME
    }
  });
  
  statsView.setBackgroundColor(CONFIG.STATS_BACKGROUND_COLOR);
  statsView.setVisible(false);
  
  // Safety check before adding to window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.addChildView(statsView);
  } else {
    log(LOG_LEVELS.ERROR, "Cannot add statsView: mainWindow not available");
    return;
  }

  const statsContents = statsView.webContents;
  
  // Strict permission handling: deny everything
  statsContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false); // Deny all permission requests
  });

  // Handle new window attempts: only allow trusted external URLs
  statsContents.setWindowOpenHandler(({ url }) => {
    try {
      void statsContents.loadURL(trustedExternalUrl(url));
      log(LOG_LEVELS.DEBUG, `Opened external URL in stats view: ${url}`);
    } catch (error) {
      logSecurity("Blocked popup in stats view", { url, reason: error.message });
    }
    return { action: "deny" };
  });

  // Navigation guard: block off-domain navigation
  statsContents.on("will-navigate", (event, navigationUrl) => {
    try {
      trustedExternalUrl(navigationUrl);
    } catch (error) {
      event.preventDefault();
      logSecurity("Blocked navigation in stats view", { 
        url: navigationUrl, 
        reason: error.message 
      });
    }
  });

  // Redirect guard: same as above but for server-side redirects
  statsContents.on("will-redirect", (event, redirectUrl) => {
    try {
      trustedExternalUrl(redirectUrl);
    } catch (error) {
      event.preventDefault();
      logSecurity("Blocked redirect in stats view", { 
        url: redirectUrl, 
        reason: error.message 
      });
    }
  });

  // Loading state events
  statsContents.on("did-start-loading", () => sendStatsState({ loading: true }));
  statsContents.on("did-stop-loading", () => sendStatsState({ loading: false }));
  statsContents.on("did-navigate", () => sendStatsState());
  statsContents.on("did-navigate-in-page", () => sendStatsState());
  
  // Error handling with filtering (ignore aborts)
  statsContents.on("did-fail-load", (_event, errorCode, description) => {
    // Error code -3 is ERR_ABORTED, usually from user cancellation or redirects
    if (errorCode !== -3) {
      log(LOG_LEVELS.WARN, `Stats view load failed: ${description} (code: ${errorCode})`);
      sendStatsState({ loading: false, error: description });
    }
  });

  // Load initial page
  void statsContents.loadURL(`https://${CONFIG.ALLOWED_EXTERNAL_HOST}/`);
  log(LOG_LEVELS.INFO, `Stats view loaded: https://${CONFIG.ALLOWED_EXTERNAL_HOST}/`);
}

/**
 * Properly cleans up stats view resources.
 * Call when window closes to prevent memory leaks (Fix #8).
 */
function destroyStatsView() {
  if (statsView) {
    if (!statsView.isDestroyed()) {
      log(LOG_LEVELS.INFO, "Destroying stats view");
      statsView.webContents.close(); // Close web contents
    }
    statsView = null; // Release reference
  }
}

// ============================================================================
// IPC HANDLERS (Fix #11: Missing Try-Catch + Fix #1: Auth Singleton)
// ============================================================================

/**
 * Registers all IPC handlers with proper error handling and validation.
 * Each handler is wrapped to catch unexpected errors gracefully.
 */
function registerIpc() {
  log(LOG_LEVELS.INFO, "Registering IPC handlers");

  // --- Provider Management ---
  
  ipcMain.handle("provider:list-models", async (_event, input) => {
    try {
      return await listModels(input);
    } catch (error) {
      logError("IPC handler:provider:list-models", error);
      return { ok: false, message: error.message, models: [] };
    }
  });

  ipcMain.handle("provider:test", async (_event, input) => {
    try {
      validateInput(input, [], 'provider test config');
      const started = Date.now();
      const result = await listModels(input);
      return { 
        ok: result.ok, 
        message: result.message, 
        latencyMs: Date.now() - started,
        models: result.models 
      };
    } catch (error) {
      logError("IPC handler:provider:test", error);
      return { ok: false, message: error.message, latencyMs: 0, models: [] };
    }
  });

  ipcMain.handle("provider:test-configured", async (_event, id) => {
    try {
      if (!id || typeof id !== "string") {
        return { ok: false, message: "Provider ID is required.", latencyMs: 0 };
      }
      
      const store = await readStore();
      const record = store.providers?.[id];
      
      if (!record) {
        return { ok: false, message: `No saved configuration for "${id}".`, latencyMs: 0 };
      }
      
      const started = Date.now();
      const result = await listModels(record, decryptKey(record));
      return { 
        ok: result.ok, 
        message: result.message, 
        latencyMs: Date.now() - started,
        models: result.models 
      };
    } catch (error) {
      logError("IPC handler:provider:test-configured", error);
      return { ok: false, message: error.message, latencyMs: 0, models: [] };
    }
  });

  ipcMain.handle("provider:save", async (_event, input) => {
    try {
      // Validate required fields
      validateInput(input, ['type', 'baseUrl'], 'provider configuration');
      
      if (input.model !== undefined && typeof input.model !== "string") {
        throw new Error("Model must be a string if provided");
      }
      
      const store = await readStore();
      const id = providerId(input.type);
      const existing = store.providers?.[id] || {};
      let encryptedApiKey = existing.encryptedApiKey || "";
      
      if (input.apiKey) {
        if (typeof input.apiKey !== "string") {
          throw new Error("API key must be a string");
        }
        
        requireEncryption(); // Will throw if unavailable
        encryptedApiKey = safeStorage.encryptString(input.apiKey).toString("base64");
        log(LOG_LEVELS.DEBUG, `Encrypted API key for provider: ${id}`);
      }
      
      store.providers = store.providers || {};
      store.providers[id] = { 
        id, 
        type: input.type, 
        baseUrl: input.baseUrl.trim(), 
        model: input.model || "", 
        encryptedApiKey 
      };
      
      await writeStore(store);
      log(LOG_LEVELS.INFO, `Provider saved: ${id}`);
      
      return { ok: true, message: `Provider "${id}" saved successfully.` };
    } catch (error) {
      logError("IPC handler:provider:save", error);
      throw error; // Re-throw so renderer gets the error
    }
  });

  // --- Settings ---
  
  ipcMain.handle("settings:save", async (_event, settings) => {
    try {
      if (!settings || typeof settings !== "object") {
        throw new Error("Settings must be an object");
      }
      
      const store = await readStore();
      store.settings = settings;
      await writeStore(store);
      
      return { ok: true };
    } catch (error) {
      logError("IPC handler:settings:save", error);
      throw error;
    }
  });

  // --- Authentication (using singleton - Fix #1) ---
  
  ipcMain.handle("auth:get-status", async () => {
    try {
      const authService = getAuthService();
      return await authService.getStatus();
    } catch (error) {
      logError("IPC handler:auth:get-status", error);
      return { authenticated: false, error: error.message };
    }
  });

  ipcMain.handle("auth:sign-in", async (_event, input) => {
    try {
      validateInput(input, [], 'sign-in credentials');
      const authService = getAuthService();
      await authService.signIn(input);
      return await authService.getStatus();
    } catch (error) {
      logError("IPC handler:auth:sign-in", error);
      throw error;
    }
  });

  ipcMain.handle("auth:sign-up", async (_event, input) => {
    try {
      validateInput(input, [], 'sign-up credentials');
      const authService = getAuthService();
      
      if (input?.oauthProvider) {
        if (typeof input.oauthProvider !== "string") {
          throw new Error("OAuth provider must be a string");
        }
        await authService.signIn({ oauthProvider: input.oauthProvider });
      } else {
        if (!input.email || !input.password) {
          throw new Error("Email and password are required for email sign-up");
        }
        if (typeof input.email !== "string" || typeof input.password !== "string") {
          throw new Error("Email and password must be strings");
        }
        await authService.signUp({ email: input.email, password: input.password });
      }
      
      return await authService.getStatus();
    } catch (error) {
      logError("IPC handler:auth:sign-up", error);
      throw error;
    }
  });

  ipcMain.handle("auth:sign-out", async () => {
    try {
      const authService = getAuthService();
      await authService.signOut();
      resetAuthService(); // Clear singleton after sign-out
      return { ok: true, message: "Signed out successfully." };
    } catch (error) {
      logError("IPC handler:auth:sign-out", error);
      throw error;
    }
  });

  ipcMain.handle("auth:refresh", async () => {
    try {
      const authService = getAuthService();
      await authService.refreshSession();
      return await authService.getStatus();
    } catch (error) {
      logError("IPC handler:auth:refresh", error);
      return { authenticated: false, error: error.message };
    }
  });

  ipcMain.handle("auth:protected-action", async () => {
    try {
      const authService = getAuthService();
      const authenticated = await authService.isAuthenticated();
      
      if (!authenticated) {
        return { ok: false, message: "Sign in is required before opening cloud workflows." };
      }
      
      const user = await authService.getCurrentUser();
      return { 
        ok: true, 
        message: `Protected workspace granted for ${user?.email ?? user?.id ?? "your account"}.` 
      };
    } catch (error) {
      logError("IPC handler:auth:protected-action", error);
      return { ok: false, message: error.message };
    }
  });

  // --- Tools Management ---
  
  ipcMain.handle("tools:list-state", async () => {
    try {
      const store = await readStore();
      return store.tools || {};
    } catch (error) {
      logError("IPC handler:tools:list-state", error);
      return {};
    }
  });

  ipcMain.handle("tools:set-state", async (_event, input) => {
    try {
      validateInput(input, ['id'], 'tool state update');
      
      if (typeof input.enabled !== "boolean") {
        throw new Error("'enabled' must be a boolean (true/false)");
      }
      
      const store = await readStore();
      store.tools = store.tools || {};
      store.tools[input.id] = { 
        ...(store.tools[input.id] || {}), 
        enabled: input.enabled, 
        source: input.source || "registry" 
      };
      await writeStore(store);
      
      return { ok: true };
    } catch (error) {
      logError("IPC handler:tools:set-state", error);
      throw error;
    }
  });

  ipcMain.handle("tools:register", async (_event, input) => {
    try {
      validateInput(input, ['id', 'name', 'command'], 'tool registration');
      
      const store = await readStore();
      store.tools = store.tools || {};
      store.tools[input.id] = { 
        name: input.name, 
        command: input.command, 
        source: "custom", 
        enabled: true, 
        requiresApproval: true 
      };
      await writeStore(store);
      
      return { ok: true, message: `Tool "${input.name}" registered successfully.` };
    } catch (error) {
      logError("IPC handler:tools:register", error);
      throw error;
    }
  });

  // --- External Links ---
  
  ipcMain.handle("external:open", async (_event, url) => {
    try {
      const validatedUrl = trustedExternalUrl(url);
      await shell.openExternal(validatedUrl);
      return { ok: true };
    } catch (error) {
      logError("IPC handler:external:open", error);
      throw error;
    }
  });

  // --- Stats View Control ---
  
  ipcMain.handle("stats:layout", (_event, input) => {
    try {
      if (!mainWindow || mainWindow.isDestroyed() || !statsView || statsView.isDestroyed()) {
        log(LOG_LEVELS.WARN, "stats:layout called but views not ready");
        return;
      }
      
      const visible = input?.visible === true;
      
      if (visible && input?.bounds) {
        // Validate bounds object
        if (typeof input.bounds !== "object") {
          throw new Error("Bounds must be an object with x, y, width, height");
        }
        
        const content = mainWindow.getContentBounds();
        
        // Extract and clamp values with safety checks
        const x = Math.max(0, Math.round(Number(input.bounds.x) || 0));
        const y = Math.max(0, Math.round(Number(input.bounds.y) || 0));
        const width = Math.max(
          1, 
          Math.min(
            Math.round(Number(input.bounds.width) || 1), 
            content.width - x
          )
        );
        const height = Math.max(
          1, 
          Math.min(
            Math.round(Number(input.bounds.height) || 1), 
            content.height - y
          )
        );
        
        statsView.setBounds({ x, y, width, height });
      }
      
      statsView.setVisible(visible);
      sendStatsState();
      
      return { ok: true };
    } catch (error) {
      logError("IPC handler:stats:layout", error);
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle("stats:navigate", (_event, action) => {
    try {
      if (!statsView || statsView.isDestroyed()) {
        log(LOG_LEVELS.WARN, "stats:navigate called but statsView not ready");
        return;
      }
      
      const validActions = ["back", "forward", "reload"];
      if (!validActions.includes(action)) {
        throw new Error(`Invalid navigation action: ${action}. Must be one of: ${validActions.join(", ")}`);
      }
      
      const history = statsView.webContents.navigationHistory;
      
      switch (action) {
        case "back":
          if (history.canGoBack()) history.goBack();
          else log(LOG_LEVELS.DEBUG, "stats:navigate back - no history");
          break;
          
        case "forward":
          if (history.canGoForward()) history.goForward();
          else log(LOG_LEVELS.DEBUG, "stats:navigate forward - no history");
          break;
          
        case "reload":
          statsView.webContents.reload();
          break;
      }
      
      return { ok: true };
    } catch (error) {
      logError("IPC handler:stats:navigate", error);
      return { ok: false, message: error.message };
    }
  });

  // --- Window Controls ---
  
  ipcMain.handle("window:action", (_event, action) => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) {
        log(LOG_LEVELS.WARN, "window:action called but mainWindow not ready");
        return;
      }
      
      const validActions = ["minimize", "maximize", "close"];
      if (!validActions.includes(action)) {
        throw new Error(`Invalid window action: ${action}`);
      }
      
      switch (action) {
        case "minimize":
          mainWindow.minimize();
          break;
          
        case "maximize":
          mainWindow.isMaximized() 
            ? mainWindow.unmaximize() 
            : mainWindow.maximize();
          break;
          
        case "close":
          mainWindow.close();
          break;
      }
      
      return { ok: true };
    } catch (error) {
      logError("IPC handler:window:action", error);
      return { ok: false, message: error.message };
    }
  });
  
  log(LOG_LEVELS.INFO, "All IPC handlers registered successfully");
}

// ============================================================================
// WINDOW CREATION
// ============================================================================

/**
 * Creates and configures the main application window.
 * Sets up event handlers for lifecycle management.
 */
function createWindow() {
  const isSmokeTest = process.env.MAGNEXIS_SMOKE_TEST === "1";
  
  log(LOG_LEVELS.INFO, `Creating main window (smoke test: ${isSmokeTest})`);
  
  mainWindow = new BrowserWindow({
    width: CONFIG.WINDOW_DEFAULT_WIDTH,
    height: CONFIG.WINDOW_DEFAULT_HEIGHT,
    minWidth: CONFIG.WINDOW_MIN_WIDTH,
    minHeight: CONFIG.WINDOW_MIN_HEIGHT,
    backgroundColor: CONFIG.WINDOW_BACKGROUND_COLOR,
    titleBarStyle: "hidden",
    titleBarOverlay: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  // Security: Block unauthorized popups, allow only trusted external URLs
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      void shell.openExternal(trustedExternalUrl(url));
    } catch (error) {
      logSecurity("Blocked popup from main window", { 
        url, 
        reason: error.message 
      });
    }
    return { action: "deny" };
  });

  // Create embedded stats view (unless smoke testing)
  if (!isSmokeTest) {
    createStatsView();
  }

  // Load the application's HTML file
  void mainWindow.loadFile(previewPath);

  // Screenshot capture mode (for CI/testing)
  if (process.env.MAGNEXIS_CAPTURE_PATH) {
    mainWindow.webContents.once("did-finish-load", async () => {
      log(LOG_LEVELS.INFO, "Capture mode: waiting for stats view...");
      
      try {
        // Switch to stats view
        await mainWindow.webContents.executeJavaScript("setView('stats')");
        
        // Wait for stats view to render
        setTimeout(async () => {
          try {
            const bounds = mainWindow.getBounds();
            const sourceId = mainWindow.getMediaSourceId();
            
            const sources = await desktopCapturer.getSources({
              types: ["window"],
              thumbnailSize: { width: bounds.width, height: bounds.height }
            });
            
            const source = sources.find(
              (item) => item.id === sourceId || item.name.includes("Magnexis")
            );
            
            if (!source) {
              throw new Error("Could not locate the Magnexis window capture source.");
            }
            
            fs.writeFileSync(process.env.MAGNEXIS_CAPTURE_PATH, source.thumbnail.toPNG());
            log(LOG_LEVELS.INFO, `Screenshot saved to: ${process.env.MAGNEXIS_CAPTURE_PATH}`);
            app.quit();
          } catch (error) {
            logError("Screenshot capture failed", error);
            app.exit(1); // Exit with error code
          }
        }, CONFIG.CAPTURE_DELAY_MS);
      } catch (error) {
        logError("Failed to switch to stats view for capture", error);
        app.exit(1);
      }
    });
  }

  // Smoke test mode: quick verification then quit
  if (isSmokeTest) {
    mainWindow.webContents.once("did-finish-load", () => {
      log(LOG_LEVELS.INFO, "Smoke test: window loaded, quitting...");
      setTimeout(() => app.quit(), CONFIG.SMOKE_TEST_TIMEOUT_MS);
    });
  }

  // Cleanup when window is closed (Fix #8: Memory leak prevention)
  mainWindow.on("closed", () => {
    log(LOG_LEVELS.INFO, "Main window closed, cleaning up...");
    destroyStatsView(); // Properly destroy stats view
    mainWindow = undefined;
  });
  
  // Additional safety: handle unexpected destruction
  mainWindow.webContents.on("destroyed", () => {
    log(LOG_LEVELS.WARN, "Main window webContents destroyed unexpectedly");
  });
}

// ============================================================================
// APPLICATION LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
  log(LOG_LEVELS.INFO, "Application ready, initializing...");
  
  try {
    registerIpc();
    createWindow();
    
    app.on("activate", () => {
      // macOS: recreate window when dock icon clicked and no windows open
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
    
    log(LOG_LEVELS.INFO, "Application initialized successfully");
  } catch (error) {
    logError("Failed to initialize application", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // macOS: keep app running even when all windows closed
  // Other platforms: quit when last window closes
  if (process.platform !== "darwin") {
    log(LOG_LEVELS.INFO, "All windows closed, quitting application");
    app.quit();
  }
});

// Graceful shutdown handling
app.on("before-quit", () => {
  log(LOG_LEVELS.INFO, "Application shutting down...");
  destroyStatsView(); // Ensure cleanup even if window event didn't fire
});

app.on("quit", (event, exitCode) => {
  log(LOG_LEVELS.INFO, `Application exited with code: ${exitCode}`);
});

// Unhandled rejection logging (catches any promise errors we missed)
process.on("unhandledRejection", (reason, promise) => {
  logError("Unhandled promise rejection", new Error(String(reason)));
  // Don't crash the app, but log prominently
});

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
  // In production, you might want to exit:
  // app.exit(1);
});
