const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('repboardDesktop', {
  setTheme: (theme) => ipcRenderer.invoke('window:theme', theme),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('window:always-on-top', enabled),
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  setKeepAwake: (enabled) => ipcRenderer.invoke('power:keep-awake', enabled)
});
