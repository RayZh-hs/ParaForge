import { useEffect, useMemo, useRef, useState } from 'react'
import { parseLevel, serializeLevel } from '../parabox/format'
import {
  addBlock,
  addRef,
  createInitialState,
  getBlockByPath,
  hitTest,
  isWithin,
  listAllBlocks,
  nextBlockId,
  pushHistory,
  redo,
  removeAt,
  setBlockAtPath,
  undo,
  upsertFloor,
  upsertWall,
  type EditorState,
  type Tool,
} from './editorState'
import { renderBlock } from './render'

const HELP = `Controls:\n- Left click: use tool\n- Right click: erase (wall/floor/ref)\n- Drag with Space: pan\n- Mouse wheel: zoom\n- Ctrl/Cmd+Z: undo, Shift+Ctrl/Cmd+Z: redo\n\nTools:\n- Select: click child block/cell object\n- Wall: toggles wall\n- Floor: paints Button or PlayerButton\n- Block: places a 3x3 child block\n- Ref: place a reference to a block id`;

export function LevelEditor() {
  const [state, setState] = useState<EditorState>(() => createInitialState())
  const [ioText, setIoText] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number } | null>(null)

  const selectedBlock = useMemo(() => getBlockByPath(state.level, state.selectedBlockPath), [state.level, state.selectedBlockPath])
  const blockList = useMemo(() => listAllBlocks(state.level), [state.level])

  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [selectedChildIndex, setSelectedChildIndex] = useState<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedBlock) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      redraw()
    }

    const redraw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderBlock({
        ctx,
        block: selectedBlock,
        zoom: state.viewport.zoom,
        panX: state.viewport.panX,
        panY: state.viewport.panY,
        hoverCell,
        selectedChildIndex,
      })
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlock])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedBlock) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderBlock({
      ctx,
      block: selectedBlock,
      zoom: state.viewport.zoom,
      panX: state.viewport.panX,
      panY: state.viewport.panY,
      hoverCell,
      selectedChildIndex,
    })
  }, [state.viewport, state.level, selectedBlock, hoverCell, selectedChildIndex])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) setState((s) => redo(s))
        else setState((s) => undo(s))
      }
      if (e.key === '?') setShowHelp((v) => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const applyToolAt = (cellX: number, cellY: number, erase: boolean) => {
    if (!selectedBlock) return
    if (!isWithin(selectedBlock, cellX, cellY)) return

    const tool = state.tool
    const level = state.level

    const block = selectedBlock

    if (tool.kind === 'Select') {
      const hit = hitTest(block, cellX, cellY)
      if (!hit) {
        setSelectedChildIndex(null)
        return
      }
      setSelectedChildIndex(hit.index)
      const obj = block.children[hit.index]
      if (obj?.kind === 'Block') {
        setState((s) => ({ ...s, selectedBlockPath: [...s.selectedBlockPath, hit.index] }))
        setSelectedChildIndex(null)
      }
      return
    }

    const path = state.selectedBlockPath

    if (erase) {
      const nextBlock = removeAt(block, cellX, cellY)
      const nextLevel = setBlockAtPath(level, path, nextBlock)
      setState((s) => pushHistory(s, nextLevel))
      setSelectedChildIndex(null)
      return
    }

    if (tool.kind === 'Wall') {
      const nextBlock = upsertWall(block, cellX, cellY)
      const nextLevel = setBlockAtPath(level, path, nextBlock)
      setState((s) => pushHistory(s, nextLevel))
      return
    }

    if (tool.kind === 'Floor') {
      const nextBlock = upsertFloor(block, cellX, cellY, { kind: tool.floorKind })
      const nextLevel = setBlockAtPath(level, path, nextBlock)
      setState((s) => pushHistory(s, nextLevel))
      return
    }

    if (tool.kind === 'Block') {
      const id = nextBlockId(level)
      const w = 3
      const h = 3
      const nextBlock = addBlock(block, cellX, cellY, w, h, id)
      const nextLevel = setBlockAtPath(level, path, nextBlock)
      setState((s) => pushHistory(s, nextLevel))
      return
    }

    if (tool.kind === 'Ref') {
      const target = tool.targetBlockId
      if (target == null) {
        setState((s) => ({ ...s, lastError: 'Pick a target block id for Ref first.' }))
        return
      }
      const nextBlock = addRef(block, cellX, cellY, target)
      const nextLevel = setBlockAtPath(level, path, nextBlock)
      setState((s) => pushHistory(s, nextLevel))
      return
    }
  }

  const toCell = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    const block = selectedBlock
    if (!canvas || !block) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left - state.viewport.panX
    const y = clientY - rect.top - state.viewport.panY
    const cellX = Math.floor(x / state.viewport.zoom)
    const cellY = Math.floor(y / state.viewport.zoom)
    return { x: cellX, y: cellY }
  }

  const onMouseMove: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    const cell = toCell(e.clientX, e.clientY)
    setHoverCell(cell)

    const drag = dragRef.current
    if (drag?.active) {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      setState((s) => ({
        ...s,
        viewport: { ...s.viewport, panX: drag.panX + dx, panY: drag.panY + dy },
      }))
    }
  }

  const onMouseDown: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    if (e.button === 1 || e.shiftKey) {
      // allow panning with middle mouse or Shift-drag
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: state.viewport.panX, panY: state.viewport.panY }
      return
    }

    const cell = toCell(e.clientX, e.clientY)
    if (!cell) return
    const erase = e.button === 2
    applyToolAt(cell.x, cell.y, erase)
  }

  const onMouseUp: React.MouseEventHandler<HTMLCanvasElement> = () => {
    if (dragRef.current) dragRef.current.active = false
  }

  const onContextMenu: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault()
  }

  const onWheel: React.WheelEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault()
    const delta = Math.sign(e.deltaY)
    setState((s) => {
      const nextZoom = clamp(s.viewport.zoom * (delta > 0 ? 0.9 : 1.1), 16, 96)
      return { ...s, viewport: { ...s.viewport, zoom: nextZoom } }
    })
  }

  const setTool = (tool: Tool) => setState((s) => ({ ...s, tool, lastError: null }))

  const onImport = () => {
    try {
      const level = parseLevel(ioText)
      setState(() => ({ ...createInitialState(), level }))
      setSelectedChildIndex(null)
      setHoverCell(null)
    } catch (e) {
      setState((s) => ({ ...s, lastError: e instanceof Error ? e.message : String(e) }))
    }
  }

  const onExport = () => {
    setIoText(serializeLevel(state.level))
  }

  const onDownload = () => {
    const txt = serializeLevel(state.level)
    const blob = new Blob([txt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'level.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onUploadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const txt = await f.text()
    setIoText(txt)
  }

  const onPickBlock = (path: number[]) => {
    setState((s) => ({ ...s, selectedBlockPath: path }))
    setSelectedChildIndex(null)
  }

  const toolLabel = (t: Tool): string => {
    if (t.kind === 'Select') return 'Select'
    if (t.kind === 'Wall') return 'Wall'
    if (t.kind === 'Floor') return `Floor:${t.floorKind}`
    if (t.kind === 'Block') return 'Block'
    return `Ref:${t.targetBlockId ?? '?'}`
  }

  const canGoUp = state.selectedBlockPath.length > 1

  const selectedBlockTitle = selectedBlock ? `Block ${selectedBlock.id} (${selectedBlock.width}x${selectedBlock.height})` : 'No block'

  return (
    <div className="pf-app">
      <header className="pf-topbar">
        <div className="pf-title">ParaForge</div>
        <div className="pf-spacer" />
        <button className="pf-btn" onClick={() => setShowHelp((v) => !v)}>
          Help (?)
        </button>
        <button className="pf-btn" onClick={() => setState((s) => undo(s))}>
          Undo
        </button>
        <button className="pf-btn" onClick={() => setState((s) => redo(s))}>
          Redo
        </button>
        <button className="pf-btn" onClick={onExport}>
          Export
        </button>
        <button className="pf-btn" onClick={onDownload}>
          Download
        </button>
      </header>

      <div className="pf-main">
        <aside className="pf-sidebar">
          <div className="pf-section">
            <div className="pf-section-title">Selection</div>
            <div className="pf-row">
              <div className="pf-muted">{selectedBlockTitle}</div>
              <div className="pf-spacer" />
              <button
                className="pf-btn"
                disabled={!canGoUp}
                onClick={() => {
                  setState((s) => ({ ...s, selectedBlockPath: s.selectedBlockPath.slice(0, -1) }))
                  setSelectedChildIndex(null)
                }}
              >
                Up
              </button>
            </div>
          </div>

          <div className="pf-section">
            <div className="pf-section-title">Tool</div>
            <div className="pf-row pf-wrap">
              <button className={btnClass(state.tool.kind === 'Select')} onClick={() => setTool({ kind: 'Select' })}>
                Select
              </button>
              <button className={btnClass(state.tool.kind === 'Wall')} onClick={() => setTool({ kind: 'Wall' })}>
                Wall
              </button>
              <button
                className={btnClass(state.tool.kind === 'Floor' && state.tool.floorKind === 'Button')}
                onClick={() => setTool({ kind: 'Floor', floorKind: 'Button' })}
              >
                Floor:Button
              </button>
              <button
                className={btnClass(state.tool.kind === 'Floor' && state.tool.floorKind === 'PlayerButton')}
                onClick={() => setTool({ kind: 'Floor', floorKind: 'PlayerButton' })}
              >
                Floor:Player
              </button>
              <button className={btnClass(state.tool.kind === 'Block')} onClick={() => setTool({ kind: 'Block' })}>
                Block
              </button>
              <button className={btnClass(state.tool.kind === 'Ref')} onClick={() => setTool({ kind: 'Ref', targetBlockId: state.tool.kind === 'Ref' ? state.tool.targetBlockId : null })}>
                Ref
              </button>
            </div>
            {state.tool.kind === 'Ref' && (
              <div className="pf-row" style={{ marginTop: 8 }}>
                <label className="pf-muted" htmlFor="refTarget">
                  Target id
                </label>
                <input
                  id="refTarget"
                  className="pf-input"
                  type="number"
                  value={state.tool.targetBlockId ?? ''}
                  onChange={(e) => setTool({ kind: 'Ref', targetBlockId: e.target.value === '' ? null : Number(e.target.value) })}
                  style={{ width: 100 }}
                />
              </div>
            )}
            <div className="pf-muted" style={{ marginTop: 8 }}>
              Current: {toolLabel(state.tool)}
            </div>
          </div>

          <div className="pf-section">
            <div className="pf-section-title">Blocks</div>
            <div className="pf-list">
              {blockList.map((b) => (
                <button key={b.id} className={listBtnClass(pathEq(b.path, state.selectedBlockPath))} onClick={() => onPickBlock(b.path)}>
                  #{b.id}
                </button>
              ))}
            </div>
          </div>

          <div className="pf-section">
            <div className="pf-section-title">Import / Export</div>
            <div className="pf-row pf-wrap">
              <button className="pf-btn" onClick={onImport}>
                Import from text
              </button>
              <label className="pf-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Load file
                <input type="file" accept=".txt,text/plain" onChange={onUploadFile} style={{ display: 'none' }} />
              </label>
            </div>
            <textarea
              className="pf-textarea"
              value={ioText}
              onChange={(e) => setIoText(e.target.value)}
              placeholder="Paste a Parabox .txt here (or click Export)."
              rows={10}
            />
          </div>

          {state.lastError && (
            <div className="pf-error">
              <div className="pf-section-title">Error</div>
              <div>{state.lastError}</div>
            </div>
          )}

          {showHelp && (
            <div className="pf-help">
              <div className="pf-section-title">Help</div>
              <pre className="pf-pre">{HELP}</pre>
            </div>
          )}
        </aside>

        <section className="pf-canvasWrap">
          <div className="pf-canvasHeader">
            <div className="pf-muted">Left click: tool • Right click: erase • Shift-drag: pan • Wheel: zoom</div>
            <div className="pf-spacer" />
            <div className="pf-muted">Zoom: {Math.round(state.viewport.zoom)}px</div>
          </div>
          <canvas
            ref={canvasRef}
            className="pf-canvas"
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onContextMenu={onContextMenu}
            onWheel={onWheel}
          />
        </section>
      </div>
    </div>
  )
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

function btnClass(active: boolean): string {
  return active ? 'pf-btn pf-btnActive' : 'pf-btn'
}

function listBtnClass(active: boolean): string {
  return active ? 'pf-listBtn pf-listBtnActive' : 'pf-listBtn'
}

function pathEq(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
