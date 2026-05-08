const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splitit", {
  startDrag: (filePath) => {
    ipcRenderer.send("splitit:start-drag", filePath);
  },
});
