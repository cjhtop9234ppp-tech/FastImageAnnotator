import { create } from 'zustand'

export const THUMB_SIZES = {
  small: { label: '작은 아이콘', cellWidth: 90 },
  medium: { label: '보통 아이콘', cellWidth: 115 },
  large: { label: '큰 아이콘', cellWidth: 160 },
  xlarge: { label: '매우 큰 아이콘', cellWidth: 220 },
  xxlarge: { label: '가장 큰 아이콘', cellWidth: 440 },
}

export const useExplorerStore = create((set, get) => ({
  rootFolder: null,
  currentFolder: null,
  folders: [],
  images: [],
  selectedImagePath: null,
  thumbSize: 'medium',

  setThumbSize(size) {
    set({ thumbSize: size })
  },

  async openFolder(folderPath) {
    set({ rootFolder: folderPath })
    await get().loadFolder(folderPath)
  },

  async loadFolder(folderPath) {
    const { folders, images } = await window.electronAPI.listFolder(folderPath)
    set({
      currentFolder: folderPath,
      folders,
      images,
      selectedImagePath: images[0]?.path ?? null,
    })
  },

  selectImage(imagePath) {
    set({ selectedImagePath: imagePath })
  },
}))
