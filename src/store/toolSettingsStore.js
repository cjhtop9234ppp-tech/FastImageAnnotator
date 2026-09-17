import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Remembers the last-used annotation tool settings (color/stroke width/font
// size) across app restarts, independent of any specific image's annotations.
export const useToolSettingsStore = create(
  persist(
    (set) => ({
      color: '#ff2d2d',
      strokeWidth: 3,
      fontSize: 28,

      setColor(color) {
        set({ color })
      },
      setStrokeWidth(strokeWidth) {
        set({ strokeWidth })
      },
      setFontSize(fontSize) {
        set({ fontSize })
      },
    }),
    { name: 'tool-settings-store' },
  ),
)
