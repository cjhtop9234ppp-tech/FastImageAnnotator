import { useRef } from 'react'
import { useExplorerStore } from './store/explorerStore'
import Sidebar from './components/Sidebar/Sidebar'
import Viewer from './components/Viewer/Viewer'
import TopToolbar from './components/TopBar/TopToolbar'
import StatusBar from './components/StatusBar/StatusBar'
import './App.css'

export default function App() {
  const canvasApiRef = useRef(null)
  const images = useExplorerStore((s) => s.images)
  const selectedImagePath = useExplorerStore((s) => s.selectedImagePath)
  const selectedImage = images.find((img) => img.path === selectedImagePath) ?? null

  return (
    <div className="app">
      <TopToolbar canvasApiRef={canvasApiRef} />
      <div className="app__body">
        <Sidebar />
        <Viewer image={selectedImage} canvasApiRef={canvasApiRef} />
      </div>
      <StatusBar />
    </div>
  )
}
