import { create } from 'zustand'

// Keyed by absolute image file path.
// entry shape: { fabricJSON: object, rotation: 0 | 90 | 180 | 270 }
export const useAnnotationStore = create((set, get) => ({
  entries: {},

  setAnnotation(path, data) {
    set((state) => ({
      entries: { ...state.entries, [path]: { ...state.entries[path], ...data } },
    }))
  },

  getAnnotation(path) {
    return get().entries[path]
  },

  hasAnnotation(path) {
    const entry = get().entries[path]
    if (!entry) return false
    const objectCount = entry.fabricJSON?.objects?.length ?? 0
    return objectCount > 0 || (entry.rotation ?? 0) !== 0
  },

  resetAnnotation(path) {
    set((state) => {
      const next = { ...state.entries }
      delete next[path]
      return { entries: next }
    })
  },

  clearAll() {
    set({ entries: {} })
  },
}))
