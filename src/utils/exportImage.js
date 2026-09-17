import { StaticCanvas } from 'fabric'

// Rotates a rendered canvas element by 0/90/180/270 degrees into a new canvas element.
function rotateCanvasElement(sourceEl, rotationDeg) {
  const srcW = sourceEl.width
  const srcH = sourceEl.height
  const swapped = rotationDeg % 180 !== 0
  const outW = swapped ? srcH : srcW
  const outH = swapped ? srcW : srcH

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')
  ctx.translate(outW / 2, outH / 2)
  ctx.rotate((rotationDeg * Math.PI) / 180)
  ctx.drawImage(sourceEl, -srcW / 2, -srcH / 2)
  return out
}

function mimeForPath(filePath) {
  const ext = filePath.split('.').pop().toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

// Renders a stored annotation entry ({ fabricJSON, rotation, width, height })
// into a final composited data URL, independent of any live/mounted canvas.
export async function composeEntryToDataUrl(entry, filePath) {
  const canvas = new StaticCanvas(null, {
    width: entry.width,
    height: entry.height,
  })

  if (entry.fabricJSON) {
    await canvas.loadFromJSON(entry.fabricJSON)
  }
  canvas.renderAll()

  const rawEl = canvas.toCanvasElement()
  const rotation = entry.rotation || 0
  const finalEl = rotation === 0 ? rawEl : rotateCanvasElement(rawEl, rotation)

  const mime = mimeForPath(filePath)
  return finalEl.toDataURL(mime, 0.92)
}
