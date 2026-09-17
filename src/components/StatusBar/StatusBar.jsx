import { useExplorerStore } from '../../store/explorerStore'
import { formatBytes } from '../../utils/format'

export default function StatusBar() {
  const folders = useExplorerStore((s) => s.folders)
  const images = useExplorerStore((s) => s.images)
  const selectedImagePath = useExplorerStore((s) => s.selectedImagePath)

  const totalSize = images.reduce((sum, img) => sum + (img.size ?? 0), 0)
  const selectedCount = selectedImagePath ? 1 : 0

  return (
    <footer className="status-bar">
      <span>{folders.length} 폴더</span>
      <span>
        {images.length} 파일{images.length ? ` (${formatBytes(totalSize)})` : ''}
      </span>
      <span>{selectedCount} 장 선택됨</span>
    </footer>
  )
}
