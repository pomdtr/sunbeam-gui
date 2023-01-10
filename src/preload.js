// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  getTheme: () => ipcRenderer.invoke("theme"),
  getAddress: () => ipcRenderer.invoke("address"),
  hideWindow: () => ipcRenderer.invoke("hideWindow"),
  copy: (text) => ipcRenderer.invoke("copy", text),
  open: (url) => ipcRenderer.invoke("open", url),
});
