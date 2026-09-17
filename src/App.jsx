import { useEffect, useRef } from 'react'
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
  const openFolder = useExplorerStore((s) => s.openFolder)
  const selectedImage = images.find((img) => img.path === selectedImagePath) ?? null

  // 다른 프로그램(PhotoDedup 등)이 폴더 경로를 인자로 넘겨 실행했을 때, 메인 프로세스가
  // 보내주는 그 폴더를 자동으로 연다 - 수동으로 "폴더 열기"를 누른 것과 동일하게 처리한다.
  useEffect(() => {
    if (!window.electronAPI?.onOpenFolder) return undefined
    return window.electronAPI.onOpenFolder((folderPath) => {
      openFolder(folderPath)
    })
  }, [openFolder])

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
