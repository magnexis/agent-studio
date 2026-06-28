const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("magnexisDesktop", {
  testProvider: (input) => ipcRenderer.invoke("provider:test", input),
  testConfiguredProvider: (providerId) => ipcRenderer.invoke("provider:test-configured", providerId),
  listProviderModels: (input) => ipcRenderer.invoke("provider:list-models", input),
  saveProvider: (input) => ipcRenderer.invoke("provider:save", input),
  saveSettings: (input) => ipcRenderer.invoke("settings:save", input),
  getAuthStatus: () => ipcRenderer.invoke("auth:get-status"),
  signIn: (input) => ipcRenderer.invoke("auth:sign-in", input),
  signUp: (input) => ipcRenderer.invoke("auth:sign-up", input),
  signOut: () => ipcRenderer.invoke("auth:sign-out"),
  refreshAuthSession: () => ipcRenderer.invoke("auth:refresh"),
  runProtectedAction: () => ipcRenderer.invoke("auth:protected-action"),
  listToolStates: () => ipcRenderer.invoke("tools:list-state"),
  setToolState: (input) => ipcRenderer.invoke("tools:set-state", input),
  registerTool: (input) => ipcRenderer.invoke("tools:register", input),
  openExternalUrl: (url) => ipcRenderer.invoke("external:open", url),
  layoutStatsView: (input) => ipcRenderer.invoke("stats:layout", input),
  navigateStatsView: (action) => ipcRenderer.invoke("stats:navigate", action),
  onStatsState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("stats:state", listener);
    return () => ipcRenderer.removeListener("stats:state", listener);
  },
  windowAction: (action) => ipcRenderer.invoke("window:action", action)
});
