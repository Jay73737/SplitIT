// pill-preload.js — child window
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pillAPI", {
  submit: (value) => ipcRenderer.send("pill:submit", value),
});
