import { Group, Line, Triangle } from 'fabric'

// Builds an arrow (shaft + head) as a single Group from (x1,y1) to (x2,y2).
export function createArrow(x1, y1, x2, y2, color, strokeWidth) {
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90
  const headLength = Math.max(10, strokeWidth * 4)

  const line = new Line([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth,
    selectable: false,
    evented: false,
  })

  const head = new Triangle({
    left: x2,
    top: y2,
    originX: 'center',
    originY: 'center',
    angle,
    width: headLength,
    height: headLength,
    fill: color,
    selectable: false,
    evented: false,
  })

  return new Group([line, head], {
    selectable: true,
    hasControls: true,
  })
}
