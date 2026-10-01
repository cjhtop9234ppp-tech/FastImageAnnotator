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

      // 원본 덮어쓰기 저장 뒤, 좌측 섬네일이 디스크의 새 내용을 다시 읽어오도록 그 사진의
      // url에 캐시 버스터를 붙인다 -- src 문자열 자체가 안 바뀌면 브라우저가 이전에 그려둔
      // 섬네일을 그대로 두고 다시 가져오지 않는다.
      refreshImageUrl(imagePath) {
        set((state) => ({
          images: state.images.map((img) =>
            img.path === imagePath
              ? { ...img, url: `${img.url.split('?')[0]}?t=${Date.now()}` }
              : img,
          ),
        }))
      },
    }),
    {
      name: 'explorer-store',
      partialize: (state) => ({ thumbSize: state.thumbSize }),
    },
  ),
)
