const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  
  // Platform detection
  platform: process.platform,
  
  // Window controls
  minimize: () => ipcRenderer.invoke('minimize-window'),
  close: () => ipcRenderer.invoke('close-window')
});