// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  getTheme: () => ipcRenderer.invoke("theme"),
  sendToPty: (text) => ipcRenderer.invoke("pty-input", text),
  resizePty: (cols, rows) => ipcRenderer.invoke("pty-resize", cols, rows),
  onPtyData: (callback) =>
    ipcRenderer.on("pty-output", (_, data) => {
      callback(data);
    }),
  onExit: () => (callback) => ipcRenderer.on("pty-exited", callback),
});
