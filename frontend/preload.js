const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  resultsOpened: (panelHeight) =>
    ipcRenderer.send("results-opened", { height: panelHeight }),
  resultsClosed: () => ipcRenderer.send("results-closed"),
});

contextBridge.exposeInMainWorld("audioAPI", {
  downloadAudioForVideo: (videoId) =>
    ipcRenderer.invoke("download-audio-for-video", { videoId }),
  downloadAudioToFile: (videoId) =>
    ipcRenderer.invoke("download-audio-to-file", { videoId }),
});
