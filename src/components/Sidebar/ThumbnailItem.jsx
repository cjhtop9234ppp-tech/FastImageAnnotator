import { useState } from 'react'
import { useAnnotationStore } from '../../store/annotationStore'

export default function ThumbnailItem({ image, selected, onSelect }) {
  const edited = useAnnotationStore((s) => s.hasAnnotation(image.path))
  const [dims, setDims] = useState(null)
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={`thumb-item${selected ? ' thumb-item--selected' : ''}`}
      onClick={() => onSelect(image.path)}
      title={image.name}
    >
      <div className="thumb-item__img-wrap">
        {failed ? (
          <div className="thumb-item__broken">🖼️</div>
        ) : (
          <img
            className="thumb-item__img"
            src={image.url}
            loading="lazy"
            alt={image.name}
            onLoad={(e) => setDims({ width: e.target.naturalWidth, height: e.target.naturalHeight })}
            onError={() => setFailed(true)}
          />
        )}
        {edited && <span className="thumb-item__edited-badge">✎</span>}
      </div>
      <div className="thumb-item__meta">
        <span>{dims ? `${dims.width}x${dims.height}` : ''}</span>
        <span>{image.ext}</span>
      </div>
      <div className="thumb-item__name">{image.name}</div>
    </div>
  )
}
