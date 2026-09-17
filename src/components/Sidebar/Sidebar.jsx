import FolderTree from './FolderTree'
import ThumbnailGrid from './ThumbnailGrid'
import ViewSizeMenu from './ViewSizeMenu'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <FolderTree />
      <div className="sidebar__toolbar">
        <ViewSizeMenu />
      </div>
      <ThumbnailGrid />
    </aside>
  )
}
