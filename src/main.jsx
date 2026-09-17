import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.DEV) {
  // Debug-only hooks for manual testing in a plain browser tab (no Electron IPC).
  Promise.all([
    import('./store/explorerStore.js'),
    import('./store/annotationStore.js'),
    import('./utils/exportImage.js'),
    import('fabric'),
  ]).then(([explorer, annotation, exportImage, fabric]) => {
    window.__debug = {
      explorerStore: explorer.useExplorerStore,
      annotationStore: annotation.useAnnotationStore,
      composeEntryToDataUrl: exportImage.composeEntryToDataUrl,
      async buildTestEntry(url) {
        const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        const canvas = new fabric.StaticCanvas(null, { width: img.width, height: img.height })
        canvas.backgroundImage = img
        canvas.renderAll()
        return { fabricJSON: canvas.toJSON(), rotation: 0, width: img.width, height: img.height }
      },
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
