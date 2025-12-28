import type { Block, Floor, Obj, Ref, Wall } from '../parabox/types'
import { hsvToRgb, rgbCss } from './colors'

export type RenderParams = {
  ctx: CanvasRenderingContext2D
  block: Block
  zoom: number
  panX: number
  panY: number
  hoverCell: { x: number; y: number } | null
  selectedChildIndex: number | null
}

export function renderBlock(params: RenderParams): void {
  const { ctx, block, zoom, panX, panY, hoverCell, selectedChildIndex } = params
  const w = ctx.canvas.width
  const h = ctx.canvas.height

  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.translate(panX, panY)

  // background
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fillRect(-panX, -panY, w, h)

  drawGrid(ctx, block.width, block.height, zoom)

  // children: blocks first (under), then cell objs
  const blocks = block.children.filter((c) => c.kind === 'Block')
  const others = block.children.filter((c) => c.kind !== 'Block')

  for (const child of blocks) drawChild(ctx, child, zoom, false)
  for (const child of others) drawChild(ctx, child, zoom, false)

  // selection outline
  if (selectedChildIndex != null) {
    const sel = block.children[selectedChildIndex]
    if (sel) drawChild(ctx, sel, zoom, true)
  }

  // hover cell
  if (hoverCell) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(hoverCell.x * zoom + 0.5, hoverCell.y * zoom + 0.5, zoom - 1, zoom - 1)
  }

  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, block.width * zoom, block.height * zoom)

  ctx.restore()
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, zoom: number): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1

  for (let x = 0; x <= width; x++) {
    const px = x * zoom + 0.5
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, height * zoom)
    ctx.stroke()
  }
  for (let y = 0; y <= height; y++) {
    const py = y * zoom + 0.5
    ctx.beginPath()
    ctx.moveTo(0, py)
    ctx.lineTo(width * zoom, py)
    ctx.stroke()
  }

  ctx.restore()
}

function drawChild(ctx: CanvasRenderingContext2D, obj: Obj, zoom: number, highlight: boolean): void {
  if (obj.kind === 'Block') {
    const rgb = hsvToRgb(obj.hue, obj.sat, obj.val)
    ctx.fillStyle = rgbCss(rgb, 0.22)
    ctx.strokeStyle = highlight ? 'rgba(255,255,255,0.8)' : rgbCss(rgb, 0.85)
    ctx.lineWidth = highlight ? 3 : 2

    ctx.fillRect(obj.x * zoom, obj.y * zoom, obj.width * zoom, obj.height * zoom)
    ctx.strokeRect(obj.x * zoom + 0.5, obj.y * zoom + 0.5, obj.width * zoom - 1, obj.height * zoom - 1)

    // id label
    ctx.fillStyle = highlight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)'
    ctx.font = `${Math.max(10, Math.floor(zoom * 0.28))}px system-ui`
    ctx.textBaseline = 'top'
    ctx.fillText(String(obj.id), obj.x * zoom + 4, obj.y * zoom + 3)

    return
  }

  if (obj.kind === 'Wall') return drawWall(ctx, obj, zoom, highlight)
  if (obj.kind === 'Ref') return drawRef(ctx, obj, zoom, highlight)
  if (obj.kind === 'Floor') return drawFloor(ctx, obj, zoom, highlight)

  const _never: never = obj
  return _never
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Wall, zoom: number, highlight: boolean): void {
  ctx.save()
  ctx.fillStyle = highlight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'
  const pad = Math.max(2, Math.floor(zoom * 0.12))
  ctx.fillRect(wall.x * zoom + pad, wall.y * zoom + pad, zoom - pad * 2, zoom - pad * 2)
  ctx.restore()
}

function drawRef(ctx: CanvasRenderingContext2D, ref: Ref, zoom: number, highlight: boolean): void {
  ctx.save()
  ctx.strokeStyle = highlight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'
  ctx.lineWidth = highlight ? 3 : 2
  const pad = Math.max(3, Math.floor(zoom * 0.18))

  ctx.strokeRect(ref.x * zoom + pad + 0.5, ref.y * zoom + pad + 0.5, zoom - (pad * 2 + 1), zoom - (pad * 2 + 1))

  ctx.fillStyle = highlight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)'
  ctx.font = `${Math.max(10, Math.floor(zoom * 0.28))}px system-ui`
  ctx.textBaseline = 'top'
  ctx.fillText(String(ref.id), ref.x * zoom + pad + 2, ref.y * zoom + pad + 1)
  ctx.restore()
}

function drawFloor(ctx: CanvasRenderingContext2D, floor: Floor, zoom: number, highlight: boolean): void {
  ctx.save()
  ctx.strokeStyle = highlight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'
  ctx.lineWidth = highlight ? 3 : 2

  const pad = Math.max(3, Math.floor(zoom * 0.22))
  ctx.beginPath()
  ctx.arc(floor.x * zoom + zoom / 2, floor.y * zoom + zoom / 2, zoom / 2 - pad, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = `${Math.max(9, Math.floor(zoom * 0.22))}px system-ui`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  const label = floorLabel(floor)
  ctx.fillText(label, floor.x * zoom + zoom / 2, floor.y * zoom + zoom / 2)
  ctx.restore()
}

function floorLabel(floor: Floor): string {
  const t = floor.type
  if (t.kind === 'Button') return 'B'
  if (t.kind === 'PlayerButton') return 'P'
  if (t.kind === 'Portal') return '↗'
  if (t.kind === 'Info') return 'i'
  if (t.kind === 'Break') return '×'
  if (t.kind === 'FastTravel') return 'F'
  if (t.kind === 'Gallery') return 'G'
  if (t.kind === 'DemoEnd') return 'E'
  return '?'
}
