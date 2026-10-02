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

// Shrinks the fitted display size so the photo doesn't fill the whole pane edge-to-edge.
const DISPLAY_SCALE = 0.7

// Ctrl+scroll zoom range and per-tick step.
const ZOOM_MIN = 0.5
const ZOOM_MAX = 5
const ZOOM_STEP = 1.1

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
  { image, tool, color, strokeWidth, fontSize, onMeta, onCanUndoChange, onZoomChange },
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
  const zoomRef = useRef(1)
  const flushTimerRef = useRef(null)
  const lastContainerWidthRef = useRef(null)

  const historyRef = useRef([]) // stack of { json, rotation }, oldest first
  const historyTimerRef = useRef(null)
  const isRestoringRef = useRef(false)

  const drawStateRef = useRef({ isDrawing: false, startPoint: null, activeShape: null })
  const panStateRef = useRef({ isPanning: false, startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0 })
  const loadIdRef = useRef(0) // bumped on every image switch; detects a stale in-flight load (see below)
  const loadQueueRef = useRef(Promise.resolve()) // serializes loads onto the shared canvas (see below)

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

  // fabric's own cleanup for an actively-edited text box's hidden <textarea>
  // relies on canvas.clear() -> discardActiveObject() -> the object's
  // onDeselect() calling exitEditing() -- but fabric's TextEditingManager
  // (which also gets cleared at the same time) just drops its own
  // reference instead of forcing that chain. If a save happens while a text
  // box is still mid-edit (never clicked away from), that hidden textarea
  // can be left attached to the document, focused, after the object itself
  // is gone -- and after a few such saves pile up, keystrokes stop reaching
  // the new text box's own (real) hidden textarea. Exiting editing
  // ourselves, right before every canvas.clear(), doesn't depend on that
  // internal chain at all.
  const exitActiveTextEditing = (canvas) => {
    // Checks every object, not just getActiveObject() -- the active-object
    // reference and "which text box is actually mid-edit" can fall out of
    // sync, and this must never miss one.
    canvas.getObjects().forEach((obj) => {
      if (obj.isEditing) obj.exitEditing()
    })
    // fabric's TextEditingManager also maintains its own state (targets array,
    // current target) that doesn't always sync with individual objects'
    // isEditing flags -- explicitly clear it too.
    canvas.textEditingManager?.clear()
  }

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

    // The container's height comes from flex-grow filling the remaining
    // column space, which is independent of its own width -- so this stays
    // stable even though we're about to set that width explicitly below.
    const padding = 8
    const availH = Math.max(container.clientHeight - padding, 50)
    // baseScale drives the panel/container size and stays constant across
    // zoom levels, so the surrounding layout (and sidebar width) doesn't
    // jump around while the user zooms. displayScale is what the canvas is
    // actually rendered at; when it exceeds the container, the container's
    // own overflow:auto makes the extra area scrollable/pannable.
    const baseScale = (availH / effH) * DISPLAY_SCALE
    const displayScale = baseScale * zoomRef.current

    const cssW = natW * displayScale
    const cssH = natH * displayScale

    canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true })

    wrapEl.style.width = `${effW * displayScale}px`
    wrapEl.style.height = `${effH * displayScale}px`

    // Hug both the photo box AND the outer .viewer panel to the base
    // (unzoomed) display width, so there's no dead space on either side at
    // zoom 100%, and zooming in doesn't shove the sidebar/panel around. The
    // panel needs this explicitly too -- otherwise the browser's shrink-to-fit
    // sizing for it falls back to the toolbar's un-wrapped max-content width
    // (flex-wrap's "as if on one line" contribution), which is much wider
    // than the photo. Skip redundant same-value writes -- rewriting every
    // resize tick can retrigger the ResizeObserver watching this element.
    const targetWidth = Math.round(effW * baseScale) + 2
    if (lastContainerWidthRef.current !== targetWidth) {
      lastContainerWidthRef.current = targetWidth
      container.style.width = `${targetWidth}px`
      const viewerEl = container.closest('.viewer')
      if (viewerEl) viewerEl.style.width = `${targetWidth}px`
    }

    const innerEl = canvas.wrapperEl
    if (innerEl) {
      innerEl.style.transform = `rotate(${rotationRef.current}deg)`
      innerEl.style.transformOrigin = 'center center'
    }
  }

  // Runs `taskFn` after whatever previous task is currently queued, so only
  // one task is ever touching the shared fabric canvas at a time (switching
  // photos, undo, and reset-after-save all mutate it). A task that goes
  // stale (a newer one was queued behind it before its turn came) skips
  // itself entirely instead of touching the canvas -- see the image-load
  // effect below for why reacting to staleness after the fact isn't safe.
  const queueCanvasTask = (taskFn) => {
    const myTaskId = ++loadIdRef.current
    const run = async () => {
      if (loadIdRef.current !== myTaskId) return
      await taskFn()
    }
    const chained = loadQueueRef.current.then(run, run)
    loadQueueRef.current = chained
    return chained
  }

  const setZoom = (next) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    if (clamped === zoomRef.current) return
    zoomRef.current = clamped
    updateDisplaySize()
    onZoomChange?.(Math.round(clamped * 100))
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
      const evt = opt.e
      // Right-drag, or Ctrl+left-drag, pans the zoomed photo around instead
      // of drawing/selecting -- works no matter which tool is active.
      if (evt.button === 2 || (evt.button === 0 && evt.ctrlKey)) {
        const container = containerRef.current
        if (!container) return
        evt.preventDefault()
        const pan = panStateRef.current
        pan.isPanning = true
        pan.startX = evt.clientX
        pan.startY = evt.clientY
        pan.startScrollLeft = container.scrollLeft
        pan.startScrollTop = container.scrollTop
        container.style.cursor = 'grabbing'
        return
      }

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
      const pan = panStateRef.current
      if (pan.isPanning) {
        const container = containerRef.current
        if (container) {
          const evt = opt.e
          container.scrollLeft = pan.startScrollLeft - (evt.clientX - pan.startX)
          container.scrollTop = pan.startScrollTop - (evt.clientY - pan.startY)
        }
        return
      }

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
      const pan = panStateRef.current
      if (pan.isPanning) {
        pan.isPanning = false
        const container = containerRef.current
        if (container) container.style.cursor = ''
        return
      }

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
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        setZoom(1)
        return
      }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        const activeTag = document.activeElement?.tagName
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return
        // 텍스트 편집 중이면 되돌리기는 텍스트 자체의 입력 취소로 맡겨둔다 (앱 되돌리기가
        // 가로채면 방금 타이핑한 글자가 아니라 도형 작업 기록이 되돌아가 버린다).
        if (canvas.getActiveObject()?.isEditing) return
        e.preventDefault()
        ref.current?.undo()
        return
      }
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

    const handleWheel = (e) => {
      if (!e.ctrlKey) return
      // Must preventDefault on the native (non-passive) listener -- Chromium
      // otherwise treats Ctrl+wheel as its own page-zoom gesture and our
      // handler never gets a say.
      e.preventDefault()
      const direction = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setZoom(zoomRef.current * direction)
    }

    // By default fabric's IText treats plain Enter the same as Shift+Enter
    // (both just insert a newline via the hidden textarea's native
    // behavior -- fabric's own onKeyDown doesn't special-case Enter at all).
    // Re-bound on every "entered editing" instead of once at creation, since
    // re-editing an existing text object later creates a brand new hidden
    // textarea each time.
    const handleTextEditingEntered = ({ target }) => {
      const textarea = target?.hiddenTextarea
      if (!textarea) return
      // 한글 입력을 기본으로 활성화: IME 자동 시작을 시뮬레이션
      // (Electron/Windows에서 한글 입력기 활성화)
      const event = new KeyboardEvent('keydown', {
        key: 'Process',
        code: 'MetaLeft',
        keyCode: 229,
        bubbles: true,
      })
      textarea.dispatchEvent(event)
      textarea.focus()
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          target.exitEditing()
        }
      })
    }

    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)
    canvas.on('object:added', handleChange)
    canvas.on('object:modified', handleChange)
    canvas.on('object:removed', handleChange)
    canvas.on('text:changed', handleChange)
    canvas.on('text:editing:entered', handleTextEditingEntered)
    window.addEventListener('keydown', handleKeyDown)
    containerRef.current?.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      containerRef.current?.removeEventListener('wheel', handleWheel)
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
    // Switching images fast enough that the PREVIOUS image's loadFromJSON /
    // FabricImage.fromURL hadn't resolved yet used to leak that previous
    // image's shapes (and even its background photo) onto this canvas: both
    // calls mutate the shared fabric canvas as soon as they resolve, no
    // matter how stale the request is by then. Checking a "stale" flag
    // AFTER the fact and reacting with canvas.clear() is not safe either --
    // that clear can land AFTER the user has already started typing/drawing
    // on the image that's actually current, wiping their in-progress work.
    // So instead of reacting to staleness, this queues every load behind
    // whichever one is currently running: only one load is ever touching
    // the shared canvas at a time, and a load that goes stale while still
    // waiting in line skips itself entirely rather than touching the canvas
    // at all, leaving it to whichever load is actually current.
    async function load() {
      const canvas = fabricRef.current
      if (!canvas) return

      flushToStore()
      // This explicit flush just captured the outgoing image's latest state,
      // so any debounced flush/history-snapshot still pending from editing
      // it is now redundant -- and dangerous if left to fire later, since by
      // then it would read the NEW image's (possibly still-loading) canvas
      // and attribute it to whichever path currentPathRef points to at that
      // moment instead.
      clearTimeout(flushTimerRef.current)
      clearTimeout(historyTimerRef.current)
      exitActiveTextEditing(canvas)
      canvas.clear()
      currentPathRef.current = image.path
      setLoadError(null)
      historyRef.current = []
      onCanUndoChange?.(false)
      zoomRef.current = 1
      onZoomChange?.(100)

      try {
        canvas.setDimensions({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })

        const stored = useAnnotationStore.getState().getAnnotation(image.path)
        if (stored?.fabricJSON) {
          await canvas.loadFromJSON(stored.fabricJSON)
        } else {
          const img = await FabricImage.fromURL(image.url, { crossOrigin: 'anonymous' })
          fitBackgroundImage(img, CANVAS_WIDTH, CANVAS_HEIGHT)
          canvas.backgroundImage = img
        }

        canvas.renderAll()

        const nextRotation = stored?.rotation ?? 0
        rotationRef.current = nextRotation
        setRotation(nextRotation)
        updateDisplaySize()
        pushHistorySnapshot()

        const bg = canvas.backgroundImage
        if (bg) onMeta?.({ width: bg.width, height: bg.height })
      } catch (err) {
        setLoadError(err.message || '이미지를 불러올 수 없습니다')
      }
    }

    queueCanvasTask(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, image?.path])

  // Keep the canvas nicely fit inside the viewer on resize.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let rafId = null
    const observer = new ResizeObserver(() => {
      // Deferring to the next frame avoids feeding back into the same
      // ResizeObserver pass (which triggers "loop completed" warnings),
      // since updateDisplaySize mutates this element's own aspect-ratio.
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateDisplaySize)
    })
    observer.observe(container)
    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
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
      // Queued like image switches/reset -- it mutates the same shared
      // canvas, and without this an in-flight image switch could otherwise
      // interleave with it.
      return queueCanvasTask(async () => {
        if (historyRef.current.length <= 1) return
        const canvas = fabricRef.current
        if (!canvas) return

        isRestoringRef.current = true
        historyRef.current.pop()
        const prev = historyRef.current[historyRef.current.length - 1]

        exitActiveTextEditing(canvas)
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
      })
    },
    // url defaults to the current photo's own (unedited) file, used by the
    // "이 사진 초기화" button; the save flow passes an explicit url instead
    // (the cache-busted overwritten file, or the untouched original for a
    // copy-save) so it reloads the correct bytes regardless of what `image`
    // currently points to.
    async reset(url = image?.url) {
      return queueCanvasTask(async () => {
        const canvas = fabricRef.current
        const path = currentPathRef.current
        if (!canvas || !path || !url) return

        clearTimeout(flushTimerRef.current)
        clearTimeout(historyTimerRef.current)
        exitActiveTextEditing(canvas)
        canvas.clear()
        canvas.setDimensions({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })

        try {
          const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
          fitBackgroundImage(img, CANVAS_WIDTH, CANVAS_HEIGHT)
          canvas.backgroundImage = img
          setLoadError(null)
        } catch (err) {
          // Still finish resetting below even if the background couldn't be
          // fetched -- the shapes are already cleared, so leaving history/
          // the stored annotation stale would be worse than showing the
          // "couldn't load" placeholder for just the background.
          setLoadError(err.message || '이미지를 불러올 수 없습니다')
        }
        canvas.renderAll()

        // canvas.clear() (and loading a new background) fires fabric's own
        // object-lifecycle events, which schedule a fresh debounced flush --
        // cancel that too, since pushHistorySnapshot/resetAnnotation below
        // already capture the correct final state directly. Left pending,
        // it would later fire flushToStore() against a mid-reset canvas and
        // silently resurrect a stale (or empty-but-not-actually-cleared)
        // entry after resetAnnotation had already run.
        clearTimeout(flushTimerRef.current)
        clearTimeout(historyTimerRef.current)

        rotationRef.current = 0
        setRotation(0)
        zoomRef.current = 1
        onZoomChange?.(100)
        updateDisplaySize()

        historyRef.current = []
        pushHistorySnapshot()

        useAnnotationStore.getState().resetAnnotation(path)
      })
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
