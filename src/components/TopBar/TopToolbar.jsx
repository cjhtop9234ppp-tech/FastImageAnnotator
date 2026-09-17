import { useState } from 'react'
import { useAnnotationStore } from '../../store/annotationStore'
import { useExplorerStore } from '../../store/explorerStore'
import { composeEntryToDataUrl } from '../../utils/exportImage'

export default function TopToolbar({ canvasApiRef }) {
  const entries = useAnnotationStore((s) => s.entries)
  const selectedImagePath = useExplorerStore((s) => s.selectedImagePath)
  const [saving, setSaving] = useState(false)
  const [pendingScope, setPendingScope] = useState(null) // 'current' | 'all' | null

  const editedPaths = Object.keys(entries).filter((path) =>
    useAnnotationStore.getState().hasAnnotation(path),
  )
  const currentIsEdited = selectedImagePath && useAnnotationStore.getState().hasAnnotation(selectedImagePath)

  const runSave = async (mode) => {
    const scope = pendingScope
    setPendingScope(null)
    setSaving(true)
    try {
      canvasApiRef.current?.flush()
      const currentEntries = useAnnotationStore.getState().entries
      const editedNow = Object.keys(currentEntries).filter((path) =>
        useAnnotationStore.getState().hasAnnotation(path),
      )
      const targets = scope === 'current' ? editedNow.filter((p) => p === selectedImagePath) : editedNow

      let successCount = 0
      for (const path of targets) {
        const entry = currentEntries[path]
        const dataUrl = await composeEntryToDataUrl(entry, path)
        await window.electronAPI.saveImage({ originalPath: path, dataUrl, mode })
        successCount += 1
      }

      alert(`${successCount}개 이미지를 저장했습니다.`)
    } catch (err) {
      console.error(err)
      alert('저장 중 오류가 발생했습니다: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCurrentClick = () => {
    if (!currentIsEdited) {
      alert('현재 선택된 이미지에 저장할 편집 내용이 없습니다.')
      return
    }
    setPendingScope('current')
  }

  const handleSaveAllClick = () => {
    if (editedPaths.length === 0) {
      alert('저장할 편집 내용이 없습니다.')
      return
    }
    setPendingScope('all')
  }

  return (
    <header className="top-toolbar">
      <div className="top-toolbar__title">FastImageAnnotator</div>
      <div className="top-toolbar__actions">
        <button className="top-toolbar__save-btn" onClick={handleSaveCurrentClick} disabled={saving}>
          {saving ? '저장 중…' : '💾 선택값만 저장'}
        </button>
        <button className="top-toolbar__save-btn" onClick={handleSaveAllClick} disabled={saving}>
          {saving ? '저장 중…' : `💾 모두 저장${editedPaths.length ? ` (${editedPaths.length})` : ''}`}
        </button>
      </div>

      {pendingScope && (
        <div className="modal-overlay" onClick={() => setPendingScope(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>저장 방식 선택</h3>
            <p>
              {pendingScope === 'current'
                ? '현재 선택된 이미지를 저장합니다.'
                : `${editedPaths.length}개 이미지에 편집 내용이 있습니다.`}
            </p>
            <div className="modal__actions">
              <button onClick={() => runSave('overwrite')}>원본 덮어쓰기</button>
              <button onClick={() => runSave('copy')}>별도 파일로 저장 (_edited)</button>
              <button className="modal__cancel" onClick={() => setPendingScope(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
