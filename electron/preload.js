import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  chooseFolder: () => ipcRenderer.invoke('fs:choose-folder'),
  listFolder: (folderPath) => ipcRenderer.invoke('fs:list-folder', folderPath),
  saveImage: (payload) => ipcRenderer.invoke('fs:save-image', payload),
})
