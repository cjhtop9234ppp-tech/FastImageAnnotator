import { useExplorerStore } from '../../store/explorerStore'

export default function FolderTree() {
  const rootFolder = useExplorerStore((s) => s.rootFolder)
  const currentFolder = useExplorerStore((s) => s.currentFolder)
  const folders = useExplorerStore((s) => s.folders)
  const openFolder = useExplorerStore((s) => s.openFolder)
  const loadFolder = useExplorerStore((s) => s.loadFolder)

  const handleChooseFolder = async () => {
    const picked = await window.electronAPI.chooseFolder()
    if (picked) await openFolder(picked)
  }

  const handleGoUp = () => {
    if (!currentFolder) return
    const parent = currentFolder.replace(/[/\\][^/\\]+$/, '')
    if (parent) loadFolder(parent)
  }

  return (
    <div className="folder-tree">
      <button className="folder-tree__open-btn" onClick={handleChooseFolder}>
        <span className="folder-tree__open-btn__icon">📁</span>
        <span className="folder-tree__open-btn__label">폴더 열기</span>
      </button>

      {currentFolder && (
        <>
          <div className="folder-tree__current" title={currentFolder}>
            {currentFolder.split(/[/\\]/).pop()}
          </div>

          <ul className="folder-tree__list">
            {currentFolder !== rootFolder && (
              <li className="folder-tree__item folder-tree__item--up" onClick={handleGoUp}>
                .. (상위 폴더)
              </li>
            )}
            {folders.map((folder) => (
              <li
                key={folder.path}
                className="folder-tree__item"
                onClick={() => loadFolder(folder.path)}
                title={folder.path}
              >
                📂 {folder.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
