import { useEffect, useRef, useCallback } from 'react'
import { useExplorerStore } from './store/explorerStore'
import { useToolSettingsStore } from './store/toolSettingsStore'
import Sidebar from './components/Sidebar/Sidebar'
import Viewer from './components/Viewer/Viewer'
import TopToolbar from './components/TopBar/TopToolbar'
import StatusBar from './components/StatusBar/StatusBar'
import './App.css'

export default function App() {
  const canvasApiRef = useRef(null)
  const toolSetterRef = useRef(null) // Will be set by Viewer
  const images = useExplorerStore((s) => s.images)
  const selectedImagePath = useExplorerStore((s) => s.selectedImagePath)
  const openFolder = useExplorerStore((s) => s.openFolder)
  const selectedImage = images.find((img) => img.path === selectedImagePath) ?? null

  // Store a reference to tool-setting callback for shortcuts
  const setToolFromShortcut = useCallback((toolId) => {
    if (toolSetterRef.current) {
      toolSetterRef.current(toolId)
    }
  }, [])

  // 다른 프로그램(PhotoDedup 등)이 폴더 경로를 인자로 넘겨 실행했을 때, 메인 프로세스가
  // 보내주는 그 폴더를 자동으로 연다 - 수동으로 "폴더 열기"를 누른 것과 동일하게 처리한다.
  useEffect(() => {
    if (!window.electronAPI?.onOpenFolder) return undefined
    return window.electronAPI.onOpenFolder((folderPath) => {
      openFolder(folderPath)
    })
  }, [openFolder])

  // 단축키 처리: 포커스가 캔버스 영역에 있을 때만 활성화
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // canvas 영역에 포커스가 없으면 무시 (텍스트 입력 중 등)
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault()
            document.querySelector('.top-toolbar__save-btn')?.click()
            break
          case 'o':
            e.preventDefault()
            const openFolderBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('결과 폴더'))
            openFolderBtn?.click()
            break
          case 't':
            e.preventDefault()
            setToolFromShortcut('text')
            break
          case 'c':
            e.preventDefault()
            setToolFromShortcut('circle')
            break
          case 'r':
            e.preventDefault()
            setToolFromShortcut('rect')
            break
          case 'a':
            e.preventDefault()
            setToolFromShortcut('arrow')
            break
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [setToolFromShortcut])

  return (
    <div className="app">
      <TopToolbar canvasApiRef={canvasApiRef} />
      <div className="app__body">
        <Sidebar />
        <Viewer
          image={selectedImage}
          canvasApiRef={canvasApiRef}
          onToolSetterReady={(setter) => { toolSetterRef.current = setter }}
        />
      </div>
      <StatusBar />
    </div>
  )
}
