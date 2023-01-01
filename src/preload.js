// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sunbeam", {
  getTheme: (theme) => ipcRenderer.invoke("theme", theme),
});

contextBridge.exposeInMainWorld("pty", {
  write: (data) => ipcRenderer.send("pty-input", data),
  onData: (callback) => {
    ipcRenderer.on("pty-output", (_, data) => callback(data));
  },
  onReady: (callback) => {
    ipcRenderer.on("pty-ready", (_, data) => callback(data));
  },
  onExit: (callback) => {
    ipcRenderer.on("pty-ready", (_, data) => callback(data));
  },
  resize: (columns, rows) => ipcRenderer.send("pty-resize", columns, rows),
});
