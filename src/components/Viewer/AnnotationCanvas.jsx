import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Canvas, Circle, FabricImage, IText, Rect } from 'fabric'
import { useAnnotationStore } from '../../store/annotationStore'
import { createArrow } from '../../utils/shapes'

const FLUSH_DEBOUNCE_MS = 250
const HISTORY_DEBOUNCE_MS = 300
const HISTORY_LIMIT = 50

// Every photo is edited (and saved) on a fixed 1600x1200 frame regardless of
// its original resolution, so annotation scale and output size stay
// consistent across a folder of mixed-resolution photos.
const CANVAS_WIDTH = 1600
const CANVAS_HEIGHT = 1200

function fitBackgroundImage(img, targetW, targetH) {
  const scale = Math.min(targetW / img.width, targetH / img.height)
  img.set({
    scaleX: scale,
    scaleY: scale,
    left: (targetW - img.width * scale) / 2,
    top: (targetH - img.height * scale) / 2,
    originX: 'left',
    originY: 'top',
  })
}

const AnnotationCanvas = forwardRef(function AnnotationCanvas(
  { image, tool, color, strokeWidth, fontSize, onMeta, onCanUndoChange },
  ref,
) {
  const containerRef = useRef(null)
  const wrapRef = useRef(null)
  const canvasElRef = useRef(null)
  const fabricRef = useRef(null)

  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const strokeWidthRef = useRef(strokeWidth)
  const fontSizeRef = useRef(fontSize)

  const currentPathRef = useRef(null)
  const rotationRef = useRef(0)
  const flushTimerRef = useRef(null)

  const historyRef = useRef([]) // stack of { json, rotation }, oldest first
  const historyTimerRef = useRef(null)
  const isRestoringRef = useRef(false)

  const drawStateRef = useRef({ isDrawing: false, startPoint: null, activeShape: null })

  const [rotation, setRotation] = useState(0)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    toolRef.current = tool
  }, [tool])
  useEffect(() => {
    colorRef.current = color
  }, [color])
  useEffect(() => {
    strokeWidthRef.current = strokeWidth
  }, [strokeWidth])
  useEffect(() => {
    fontSizeRef.current = fontSize
  }, [fontSize])

  const flushToStore = () => {
    const canvas = fabricRef.current
    const path = currentPathRef.current
    if (!canvas || !path) return
    useAnnotationStore.getState().setAnnotation(path, {
      fabricJSON: canvas.toJSON(),
      rotation: rotationRef.current,
      width: canvas.width,
      height: canvas.height,
    })
  }

  const scheduleFlush = () => {
    clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flushToStore, FLUSH_DEBOUNCE_MS)
  }

  const pushHistorySnapshot = () => {
    if (isRestoringRef.current) return
    const canvas = fabricRef.current
    if (!canvas) return
    historyRef.current.push({ json: canvas.toJSON(), rotation: rotationRef.current })
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift()
    onCanUndoChange?.(historyRef.current.length > 1)
  }

  const scheduleHistorySnapshot = () => {
    clearTimeout(historyTimerRef.current)
    historyTimerRef.current = setTimeout(pushHistorySnapshot, HISTORY_DEBOUNCE_MS)
  }

  const updateDisplaySize = () => {
    const canvas = fabricRef.current
    const container = containerRef.current
    const wrapEl = wrapRef.current
    if (!canvas || !container || !wrapEl) return

    const natW = canvas.width
    const natH = canvas.height
    if (!natW || !natH) return

    const rotated = rotationRef.current % 180 !== 0
    const effW = rotated ? natH : natW
    const effH = rotated ? natW : natH

    container.style.aspectRatio = `${effW} / ${effH}`

    const rect = container.getBoundingClientRect()
    const padding = 8
    const availW = Math.max(rect.width - padding, 50)
    const availH = Math.max(rect.height - padding, 50)
    const scale = Math.min(availW / effW, availH / effH)

    const cssW = natW * scale
    const cssH = natH * scale

    canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true })

    wrapEl.style.width = `${effW * scale}px`
    wrapEl.style.height = `${effH * scale}px`

    const innerEl = canvas.wrapperEl
    if (innerEl) {
      innerEl.style.position = 'absolute'
      innerEl.style.left = '50%'
      innerEl.style.top = '50%'
      innerEl.style.transform = `translate(-50%, -50%) rotate(${rotationRef.current}deg)`
      innerEl.style.transformOrigin = 'center center'
    }
  }

  // Create the fabric canvas once.
  useEffect(() => {
    const canvas = new Canvas(canvasElRef.current, {
      selection: true,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas
    setReady(true)

    const handleMouseDown = (opt) => {
      const currentTool = toolRef.current
      if (currentTool === 'select') return
      const pointer = canvas.getScenePoint(opt.e)
      const state = drawStateRef.current

      if (currentTool === 'text') {
        const text = new IText('텍스트', {
          left: pointer.x,
          top: pointer.y,
          fill: colorRef.current,
          fontSize: fontSizeRef.current,
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        text.selectAll()
        pushHistorySnapshot()
        return
      }

      state.isDrawing = true
      state.startPoint = pointer

      if (currentTool === 'circle') {
        state.activeShape = new Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 1,
          stroke: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          fill: 'transparent',
          originX: 'center',
          originY: 'center',
        })
      } else if (currentTool === 'rect') {
        state.activeShape = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 1,
          height: 1,
          stroke: colorRef.current,
          strokeWidth: strokeWidthRef.current,
          fill: 'transparent',
        })
      } else if (currentTool === 'arrow') {
        state.activeShape = createArrow(
          pointer.x,
          pointer.y,
          pointer.x,
          pointer.y,
          colorRef.current,
          strokeWidthRef.current,
        )
      }

      if (state.activeShape) canvas.add(state.activeShape)
    }

    const handleMouseMove = (opt) => {
      const state = drawStateRef.current
      if (!state.isDrawing || !state.activeShape) return
      const pointer = canvas.getScenePoint(opt.e)
      const currentTool = toolRef.current

      if (currentTool === 'circle') {
        const radius = Math.max(
          Math.hypot(pointer.x - state.startPoint.x, pointer.y - state.startPoint.y) / 2,
          1,
        )
        const centerX = (pointer.x + state.startPoint.x) / 2
        const centerY = (pointer.y + state.startPoint.y) / 2
        state.activeShape.set({ left: centerX, top: centerY, radius })
      } else if (currentTool === 'rect') {
        const width = pointer.x - state.startPoint.x
        const height = pointer.y - state.startPoint.y
        state.activeShape.set({
          left: width < 0 ? pointer.x : state.startPoint.x,
          top: height < 0 ? pointer.y : state.startPoint.y,
          width: Math.abs(width),
          height: Math.abs(height),
        })
      } else if (currentTool === 'arrow') {
        canvas.remove(state.activeShape)
        state.activeShape = createArrow(
          state.startPoint.x,
          state.startPoint.y,
          pointer.x,
          pointer.y,
          colorRef.current,
          strokeWidthRef.current,
        )
        canvas.add(state.activeShape)
      }

      canvas.requestRenderAll()
    }

    const handleMouseUp = () => {
      const state = drawStateRef.current
      if (!state.isDrawing) return
      state.isDrawing = false
      if (state.activeShape) {
        state.activeShape.setCoords()
        canvas.setActiveObject(state.activeShape)
      }
      state.activeShape = null
      canvas.requestRenderAll()
      scheduleFlush()
      pushHistorySnapshot()
    }

    const handleChange = () => scheduleFlush()

    const handleKeyDown = (e) => {
      if (e.key !== 'Delete') return
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return
      const active = canvas.getActiveObject()
      if (!active || active.isEditing) return
      e.preventDefault()
      canvas.remove(active)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      scheduleFlush()
      pushHistorySnapshot()
    }

    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)
    canvas.on('object:added', handleChange)
    canvas.on('object:modified', handleChange)
    canvas.on('object:removed', handleChange)
    canvas.on('text:changed', handleChange)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(flushTimerRef.current)
      clearTimeout(historyTimerRef.current)
      window.removeEventListener('keydown', handleKeyDown)
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  // Toggle selection vs. drawing interaction mode.
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const drawing = tool !== 'select'
    canvas.selection = !drawing
    canvas.skipTargetFind = drawing
    canvas.defaultCursor = drawing ? 'crosshair' : 'default'
    canvas.hoverCursor = drawing ? 'crosshair' : 'move'
  }, [tool, ready])

  // Live-update the selected object when color/size controls change.
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return

    if (active.type === 'i-text' || active.type === 'textbox') {
      active.set({ fill: color, fontSize })
    } else if (active.type === 'group') {
      active._objects?.forEach((obj) => {
        if (obj.type === 'line') obj.set({ stroke: color, strokeWidth })
        else if (obj.type === 'triangle') obj.set({ fill: color })
      })
    } else {
      active.set({ stroke: color, strokeWidth })
    }
    canvas.requestRenderAll()
    scheduleFlush()
    scheduleHistorySnapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeWidth, fontSize])

  // Load a new image into the canvas whenever the selected image changes.
  useEffect(() => {
    if (!ready || !image) return
    let cancelled = false

    async function load() {
      const canvas = fabricRef.current
      if (!canvas) return

      flushToStore()
      canvas.clear()
      currentPathRef.current = image.path
      setLoadError(null)
      historyRef.current = []
      onCanUndoChange?.(false)

      try {
        canvas.setDimensions({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })

        const stored = useAnnotationStore.getState().getAnnotation(image.path)
        if (stored?.fabricJSON) {
          await canvas.loadFromJSON(stored.fabricJSON)
        } else {
          const img = await FabricImage.fromURL(image.url, { crossOrigin: 'anonymous' })
          if (cancelled) return
          fitBackgroundImage(img, CANVAS_WIDTH, CANVAS_HEIGHT)
          canvas.backgroundImage = img
        }
        if (cancelled) return

        canvas.renderAll()

        const nextRotation = stored?.rotation ?? 0
        rotationRef.current = nextRotation
        setRotation(nextRotation)
        updateDisplaySize()
        pushHistorySnapshot()

        const bg = canvas.backgroundImage
        if (bg) onMeta?.({ width: bg.width, height: bg.height })
      } catch (err) {
        if (!cancelled) setLoadError(err.message || '이미지를 불러올 수 없습니다')
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, image?.path])

  // Keep the canvas nicely fit inside the viewer on resize.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => updateDisplaySize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useImperativeHandle(ref, () => ({
    rotateLeft() {
      rotationRef.current = (rotationRef.current + 270) % 360
      setRotation(rotationRef.current)
      updateDisplaySize()
      scheduleFlush()
      pushHistorySnapshot()
    },
    rotateRight() {
      rotationRef.current = (rotationRef.current + 90) % 360
      setRotation(rotationRef.current)
      updateDisplaySize()
      scheduleFlush()
      pushHistorySnapshot()
    },
    async undo() {
      if (historyRef.current.length <= 1) return
      const canvas = fabricRef.current
      if (!canvas) return

      isRestoringRef.current = true
      historyRef.current.pop()
      const prev = historyRef.current[historyRef.current.length - 1]

      canvas.clear()
      canvas.setDimensions({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
      await canvas.loadFromJSON(prev.json)
      canvas.renderAll()

      rotationRef.current = prev.rotation
      setRotation(prev.rotation)
      updateDisplaySize()
      isRestoringRef.current = false

      onCanUndoChange?.(historyRef.current.length > 1)
      scheduleFlush()
    },
    async reset() {
      const canvas = fabricRef.current
      const path = currentPathRef.current
      if (!canvas || !path) return

      canvas.clear()
      canvas.setDimensions({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
      const img = await FabricImage.fromURL(image.url, { crossOrigin: 'anonymous' })
      fitBackgroundImage(img, CANVAS_WIDTH, CANVAS_HEIGHT)
      canvas.backgroundImage = img
      canvas.renderAll()

      rotationRef.current = 0
      setRotation(0)
      updateDisplaySize()

      historyRef.current = []
      pushHistorySnapshot()

      useAnnotationStore.getState().resetAnnotation(path)
    },
    flush() {
      flushToStore()
    },
  }))

  return (
    <div className="annotation-canvas__container" ref={containerRef}>
      <div className="annotation-canvas__wrap" ref={wrapRef} style={{ visibility: loadError ? 'hidden' : 'visible' }}>
        <canvas ref={canvasElRef} />
      </div>
      {loadError && (
        <div className="annotation-canvas__error">
          <span>🖼️</span>
          <span>이미지를 불러올 수 없습니다</span>
        </div>
      )}
    </div>
  )
})

export default AnnotationCanvas
