// preload.js — main window
const { contextBridge, ipcRenderer } = require("electron");

function addElectronClass() {
  const add = () => document.documentElement.classList.add("is-electron");
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", add, { once: true });
  } else {
    add();
  }
}
addElectronClass();

contextBridge.exposeInMainWorld("electronAPI", {
  setPillGeometry: (bounds) => ipcRenderer.send("pill:set-geometry", bounds),
  onPillSubmit: (fn) => ipcRenderer.on("pill:submit", (_e, v) => fn(v)),
  resultsOpened: (height) => ipcRenderer.send("results-opened", height),
  resultsClosed: () => ipcRenderer.send("results-closed"),
  downloadStems: (payload) => ipcRenderer.invoke("stems:download-all", payload),
  dragStem: (payload) => ipcRenderer.send("stems:drag-file", payload),
  dragWaveformClip: (payload) => ipcRenderer.send("waveform:drag-clip", payload),
  dragWaveformEnd: () => ipcRenderer.send("waveform:drag-end"),
  pickSaveFolder: () => ipcRenderer.invoke("settings:pick-folder"),
  getDefaultSaveFolder: () => ipcRenderer.invoke("settings:get-default-folder"),
});
