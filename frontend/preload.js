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
});
