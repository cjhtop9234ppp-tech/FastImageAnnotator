import { useEffect, useState } from 'react'
import AnnotationCanvas from './AnnotationCanvas'
import AnnotationToolbar from './AnnotationToolbar'
import { formatBytes, formatDate } from '../../utils/format'

export default function Viewer({ image, canvasApiRef }) {
  const [tool, setTool] = useState('select')
  const [color, setColor] = useState('#ff2d2d')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [fontSize, setFontSize] = useState(28)
  const [meta, setMeta] = useState(null)
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => {
    setMeta(null)
  }, [image?.path])

  if (!image) {
    return (
      <section className="viewer viewer--empty">
        <p>왼쪽에서 폴더를 열고 이미지를 선택하세요</p>
      </section>
    )
  }

  const handleReset = () => {
    if (window.confirm('이 사진의 모든 편집 내용을 초기화할까요?')) {
      canvasApiRef.current?.reset()
      setTool('select')
    }
  }

  return (
    <section className="viewer">
      <AnnotationCanvas
        ref={canvasApiRef}
        image={image}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        fontSize={fontSize}
        onMeta={setMeta}
        onCanUndoChange={setCanUndo}
      />
      <div className="viewer-info-bar">
        <span className="viewer-info-bar__name">{image.name}</span>
        {meta && <span>{meta.width}x{meta.height}</span>}
        <span>{formatBytes(image.size)}</span>
        <span>{formatDate(image.mtimeMs)}</span>
      </div>
      <AnnotationToolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        onRotateLeft={() => canvasApiRef.current?.rotateLeft()}
        onRotateRight={() => canvasApiRef.current?.rotateRight()}
        onUndo={() => canvasApiRef.current?.undo()}
        canUndo={canUndo}
        onReset={handleReset}
      />
    </section>
  )
}
