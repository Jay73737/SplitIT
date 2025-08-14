// preload.js (CommonJS)
//
// This preload script exposes a minimal API surface to the renderer
// process.  Using Electron's contextBridge it makes IPC functions
// available under window.electronAPI and window.audioAPI.  These APIs
// provide safe methods for resizing the window and for downloading
// audio from YouTube via ytdl-core in the main process.

const { contextBridge, ipcRenderer } = require("electron");

// General UI helpers: open/close results panel
contextBridge.exposeInMainWorld("electronAPI", {
  resultsOpened: (panelHeight) =>
    ipcRenderer.send("results-opened", { height: panelHeight }),
  resultsClosed: () => ipcRenderer.send("results-closed"),
});

// Audio helpers: download audio either into memory or into a file
contextBridge.exposeInMainWorld("audioAPI", {
  /**
   * Download audio data for a given YouTube video ID.
   * Returns an object with fields { mime: string, data: ArrayBuffer }.
   */
  downloadAudioForVideo: (videoId) =>
    ipcRenderer.invoke("download-audio-for-video", { videoId }),
  /**
   * Download audio and save it to the user's Downloads directory.
   * Returns an object with fields { filePath: string, mime: string }.
   */
  downloadAudioToFile: (videoId) =>
    ipcRenderer.invoke("download-audio-to-file", { videoId }),
});
