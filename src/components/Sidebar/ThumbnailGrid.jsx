import { useEffect, useRef, useState } from 'react'
import { useExplorerStore, THUMB_SIZES } from '../../store/explorerStore'
import ThumbnailItem from './ThumbnailItem'

const GAP = 10
const META_HEIGHT = 40 // meta row + filename row
const BUFFER_ROWS = 3

export default function ThumbnailGrid() {
  const images = useExplorerStore((s) => s.images)
  const selectedImagePath = useExplorerStore((s) => s.selectedImagePath)
  const selectImage = useExplorerStore((s) => s.selectImage)
  const thumbSize = useExplorerStore((s) => s.thumbSize)
  const cellWidth = THUMB_SIZES[thumbSize].cellWidth
  const rowHeight = cellWidth + META_HEIGHT + GAP

  const containerRef = useRef(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)
  const tickingRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setViewport({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    setViewport({ width: el.clientWidth, height: el.clientHeight })
    return () => observer.disconnect()
  }, [])

  const handleScroll = () => {
    if (tickingRef.current) return
    tickingRef.current = true
    requestAnimationFrame(() => {
      setScrollTop(containerRef.current?.scrollTop ?? 0)
      tickingRef.current = false
    })
  }

  if (images.length === 0) {
    return (
      <div className="thumb-grid thumb-grid--empty" ref={containerRef}>
        이 폴더에 이미지가 없습니다
      </div>
    )
  }

  const columns = Math.max(1, Math.floor((viewport.width + GAP) / (cellWidth + GAP)))
  const totalRows = Math.ceil(images.length / columns)

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS)
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + viewport.height) / rowHeight) + BUFFER_ROWS,
  )

  const startIndex = startRow * columns
  const endIndex = Math.min(images.length, (endRow + 1) * columns)
  const visibleImages = images.slice(startIndex, endIndex)

  const topPadding = startRow * rowHeight
  const bottomPadding = Math.max(0, (totalRows - endRow - 1) * rowHeight)

  return (
    <div className="thumb-grid" ref={containerRef} onScroll={handleScroll}>
      <div style={{ height: topPadding }} />
      <div
        className="thumb-grid__inner"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: GAP,
          '--thumb-img-height': `${cellWidth}px`,
        }}
      >
        {visibleImages.map((image) => (
          <ThumbnailItem
            key={image.path}
            image={image}
            selected={image.path === selectedImagePath}
            onSelect={selectImage}
          />
        ))}
      </div>
      <div style={{ height: bottomPadding }} />
    </div>
  )
}
