import { useState } from 'react'
import { useAnnotationStore } from '../../store/annotationStore'
import { useExplorerStore } from '../../store/explorerStore'
import { composeEntryToDataUrl } from '../../utils/exportImage'

export default function TopToolbar({ canvasApiRef }) {
  const entries = useAnnotationStore((s) => s.entries)
  const selectedImagePath = useExplorerStore((s) => s.selectedImagePath)
  const currentFolder = useExplorerStore((s) => s.currentFolder)
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
        // 원본 덮어쓰기일 때만 디스크 내용이 실제로 바뀌므로, 그때만 좌측 섬네일을
        // 새로 저장된 내용으로 갱신한다 (복사본 저장은 원본 파일을 안 건드린다).
        if (mode === 'overwrite') {
          useExplorerStore.getState().refreshImageUrl(path)
        }
        // 저장이 끝난 사진은 편집 내용을 비워서, 다음에 "모두 저장"을 눌렀을 때
        // 이미 저장된 사진이 계속 또 저장되지 않게 한다 -- 이미 디스크에(또는
        // 복사본으로) 반영됐으니 더 이상 "편집 중"으로 남아있을 이유가 없다.
        if (path === selectedImagePath) {
          // 지금 우측 화면에 떠 있는 사진이면, 방금 저장된(덮어쓰기면 새로 바뀐
          // 캐시버스터 URL, 복사본 저장이면 안 건드린 원본 URL) 내용으로 화면도
          // 함께 초기화한다 -- canvasApiRef.reset()이 편집 내용 리셋까지 처리한다.
          const freshUrl = useExplorerStore.getState().images.find((img) => img.path === path)?.url
          await canvasApiRef.current?.reset(freshUrl)
        } else {
          useAnnotationStore.getState().resetAnnotation(path)
        }
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

  const handleOpenInExplorer = async () => {
    if (!currentFolder) return
    try {
      await window.electronAPI.openInExplorer(currentFolder)
    } catch (err) {
      alert('폴더를 여는 중 오류가 발생했습니다: ' + err.message)
    }
  }

  return (
    <header className="top-toolbar">
      <div className="top-toolbar__left">
        <div className="top-toolbar__title">FastImageAnnotator v{__APP_VERSION__}</div>
        <button className="top-toolbar__save-btn" onClick={handleSaveCurrentClick} disabled={saving}>
          {saving ? '저장 중…' : '💾 선택값만 저장'}
        </button>
      </div>
      <div className="top-toolbar__right">
        <button className="top-toolbar__save-btn" onClick={handleOpenInExplorer} disabled={!currentFolder}>
          📂 결과 폴더 열기
        </button>
        <button className="top-toolbar__save-btn top-toolbar__save-btn--primary" onClick={handleSaveAllClick} disabled={saving}>
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
