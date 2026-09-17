const TOOLS = [
  { id: 'select', label: '↖ 선택' },
  { id: 'text', label: 'T 텍스트' },
  { id: 'circle', label: '○ 원' },
  { id: 'rect', label: '▭ 사각형' },
  { id: 'arrow', label: '↗ 화살표' },
]

export default function AnnotationToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  fontSize,
  onFontSizeChange,
  onRotateLeft,
  onRotateRight,
  onUndo,
  canUndo,
  onReset,
  disabled,
}) {
  return (
    <div className="annotation-toolbar">
      <div className="annotation-toolbar__row">
        <div className="annotation-toolbar__group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`annotation-toolbar__btn${tool === t.id ? ' annotation-toolbar__btn--active' : ''}`}
              onClick={() => onToolChange(t.id)}
              disabled={disabled}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="annotation-toolbar__group">
          <label className="annotation-toolbar__label">
            색상
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              disabled={disabled}
            />
          </label>

          <label className="annotation-toolbar__label">
            선 굵기
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
              disabled={disabled}
            />
            <span className="annotation-toolbar__value">{strokeWidth}</span>
          </label>

          <label className="annotation-toolbar__label">
            글자 크기
            <input
              type="number"
              min="8"
              max="200"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              disabled={disabled}
            />
          </label>
        </div>
      </div>

      <div className="annotation-toolbar__row">
        <div className="annotation-toolbar__group">
          <button className="annotation-toolbar__btn" onClick={onRotateLeft} disabled={disabled}>
            ⟲ 좌회전
          </button>
          <button className="annotation-toolbar__btn" onClick={onRotateRight} disabled={disabled}>
            ⟳ 우회전
          </button>
          <button className="annotation-toolbar__btn" onClick={onUndo} disabled={disabled || !canUndo}>
            ↩ 되돌리기
          </button>
          <button
            className="annotation-toolbar__btn annotation-toolbar__btn--danger"
            onClick={onReset}
            disabled={disabled}
          >
            이 사진 초기화
          </button>
        </div>
      </div>
    </div>
  )
}
