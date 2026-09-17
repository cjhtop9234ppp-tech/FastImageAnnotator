import { useState } from 'react'
import { useExplorerStore, THUMB_SIZES } from '../../store/explorerStore'

export default function ViewSizeMenu() {
  const thumbSize = useExplorerStore((s) => s.thumbSize)
  const setThumbSize = useExplorerStore((s) => s.setThumbSize)
  const [open, setOpen] = useState(false)

  return (
    <div className="view-size-menu">
      <button className="view-size-menu__trigger" onClick={() => setOpen((v) => !v)}>
        🔍 보기: {THUMB_SIZES[thumbSize].label} ▾
      </button>
      {open && (
        <>
          <div className="view-size-menu__backdrop" onClick={() => setOpen(false)} />
          <ul className="view-size-menu__list">
            {Object.entries(THUMB_SIZES).map(([key, { label }]) => (
              <li
                key={key}
                className={`view-size-menu__item${key === thumbSize ? ' view-size-menu__item--selected' : ''}`}
                onClick={() => {
                  setThumbSize(key)
                  setOpen(false)
                }}
              >
                {key === thumbSize ? '✓ ' : '  '}
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
