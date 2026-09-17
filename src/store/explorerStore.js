import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const THUMB_SIZES = {
  small: { label: '작은 아이콘', cellWidth: 90 },
  medium: { label: '보통 아이콘', cellWidth: 115 },
  large: { label: '큰 아이콘', cellWidth: 160 },
  xlarge: { label: '매우 큰 아이콘', cellWidth: 220 },
  xxlarge_mid: { label: '매우 가장 중간 큰 아이콘', cellWidth: 330 },
  xxlarge: { label: '가장 큰 아이콘', cellWidth: 440 },
}

export const useExplorerStore = create(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'explorer-store',
      partialize: (state) => ({ thumbSize: state.thumbSize }),
    },
  ),
)
