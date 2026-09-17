import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  chooseFolder: () => ipcRenderer.invoke('fs:choose-folder'),
  listFolder: (folderPath) => ipcRenderer.invoke('fs:list-folder', folderPath),
  saveImage: (payload) => ipcRenderer.invoke('fs:save-image', payload),
  onOpenFolder: (callback) => {
    const listener = (_event, folderPath) => callback(folderPath)
    ipcRenderer.on('open-folder', listener)
    return () => ipcRenderer.removeListener('open-folder', listener)
  },
})
