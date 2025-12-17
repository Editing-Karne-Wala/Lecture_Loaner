const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendAllowClose: () => ipcRenderer.send('allow-close'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  onInitArgs: (callback) => ipcRenderer.on('init-args', (event, args) => callback(args)),
  copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text)
});