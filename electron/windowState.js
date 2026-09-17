import Store from 'electron-store'

const store = new Store({
  name: 'window-state',
  defaults: {
    bounds: { width: 1280, height: 800, x: undefined, y: undefined },
  },
})

const DEBOUNCE_MS = 400

export function restoreBounds() {
  return store.get('bounds')
}

export function trackWindowState(win) {
  let timer = null

  const save = () => {
    if (win.isDestroyed()) return
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
    store.set('bounds', bounds)
  }

  const debouncedSave = () => {
    clearTimeout(timer)
    timer = setTimeout(save, DEBOUNCE_MS)
  }

  win.on('resize', debouncedSave)
  win.on('move', debouncedSave)
  win.on('close', () => {
    clearTimeout(timer)
    save()
  })
}

export function getLastFolder() {
  return store.get('lastFolder', null)
}

export function setLastFolder(folderPath) {
  store.set('lastFolder', folderPath)
}
