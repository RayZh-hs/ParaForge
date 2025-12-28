import type { Block, Floor, Level, Obj, Ref, Wall } from '../parabox/types'
import { createEmptyLevel } from '../parabox/types'

export type Tool =
  | { kind: 'Select' }
  | { kind: 'Wall' }
  | { kind: 'Floor'; floorKind: 'Button' | 'PlayerButton' }
  | { kind: 'Block' }
  | { kind: 'Ref'; targetBlockId: number | null }

export type Selection =
  | { kind: 'None' }
  | { kind: 'Block'; path: number[] } // indexes through roots/children
  | { kind: 'Obj'; parentPath: number[]; index: number }

export type Viewport = {
  panX: number
  panY: number
  zoom: number
}

export type EditorState = {
  level: Level
  selectedBlockPath: number[]
  tool: Tool
  viewport: Viewport
  lastError: string | null
  history: { past: Level[]; future: Level[] }
}

export function createInitialState(): EditorState {
  const level = createEmptyLevel()
  return {
    level,
    selectedBlockPath: [0],
    tool: { kind: 'Select' },
    viewport: { panX: 0, panY: 0, zoom: 48 },
    lastError: null,
    history: { past: [], future: [] },
  }
}

export function getBlockByPath(level: Level, path: number[]): Block | null {
  if (path.length === 0) return null
  let current: Block | undefined = level.roots[path[0]]
  for (let i = 1; i < path.length; i++) {
    if (!current) return null
    const idx = path[i]
    const obj: Obj | undefined = current.children[idx]
    if (!obj || obj.kind !== 'Block') return null
    current = obj
  }
  return current ?? null
}

export function nextBlockId(level: Level): number {
  let maxId = -1
  walkBlocks(level, (b) => {
    if (b.id > maxId) maxId = b.id
  })
  return maxId + 1
}

function walkBlocks(level: Level, fn: (b: Block) => void): void {
  const walk = (b: Block) => {
    fn(b)
    for (const c of b.children) if (c.kind === 'Block') walk(c)
  }
  for (const r of level.roots) walk(r)
}

export function cloneLevel(level: Level): Level {
  // structuredClone is supported in modern browsers; Vite targets modern.
  return structuredClone(level)
}

export function pushHistory(state: EditorState, next: Level): EditorState {
  return {
    ...state,
    level: next,
    history: { past: [...state.history.past, state.level], future: [] },
  }
}

export function undo(state: EditorState): EditorState {
  const past = state.history.past
  if (past.length === 0) return state
  const prev = past[past.length - 1]
  return {
    ...state,
    level: prev,
    history: { past: past.slice(0, -1), future: [state.level, ...state.history.future] },
  }
}

export function redo(state: EditorState): EditorState {
  const future = state.history.future
  if (future.length === 0) return state
  const next = future[0]
  return {
    ...state,
    level: next,
    history: { past: [...state.history.past, state.level], future: future.slice(1) },
  }
}

export function upsertWall(block: Block, x: number, y: number): Block {
  const next = structuredClone(block)
  const idx = next.children.findIndex((c) => c.kind === 'Wall' && c.x === x && c.y === y)
  if (idx >= 0) {
    next.children.splice(idx, 1)
    return next
  }
  const wall: Wall = { kind: 'Wall', x, y, player: 0, possessable: 0, playerorder: 0 }
  next.children.push(wall)
  return next
}

export function upsertFloor(block: Block, x: number, y: number, floor: Floor['type']): Block {
  const next = structuredClone(block)
  const idx = next.children.findIndex((c) => c.kind === 'Floor' && c.x === x && c.y === y)
  const obj: Floor = { kind: 'Floor', x, y, type: floor }
  if (idx >= 0) next.children[idx] = obj
  else next.children.push(obj)
  return next
}

export function removeAt(block: Block, x: number, y: number): Block {
  const next = structuredClone(block)
  next.children = next.children.filter((c) => {
    if (c.kind === 'Block') return true
    return !(c.x === x && c.y === y)
  })
  return next
}

export function addBlock(block: Block, x: number, y: number, width: number, height: number, id: number): Block {
  const next = structuredClone(block)
  const child: Block = {
    kind: 'Block',
    x,
    y,
    id,
    width,
    height,
    hue: block.hue,
    sat: block.sat,
    val: block.val,
    zoomfactor: 1,
    fillwithwalls: 0,
    player: 0,
    possessable: 0,
    playerorder: 0,
    fliph: 0,
    floatinspace: 0,
    specialeffect: 0,
    children: [],
  }
  next.children.push(child)
  return next
}

export function addRef(block: Block, x: number, y: number, id: number): Block {
  const next = structuredClone(block)
  const ref: Ref = {
    kind: 'Ref',
    x,
    y,
    id,
    exitblock: 0,
    infexit: 0,
    infexitnum: 0,
    infenter: 0,
    infenternum: 0,
    infenterid: -1,
    player: 0,
    possessable: 0,
    playerorder: 0,
    fliph: 0,
    floatinspace: 0,
    specialeffect: 0,
  }
  // overwrite existing non-block at cell
  next.children = next.children.filter((c) => (c.kind === 'Block' ? true : !(c.x === x && c.y === y)))
  next.children.push(ref)
  return next
}

export function setBlockAtPath(level: Level, path: number[], block: Block): Level {
  const next = cloneLevel(level)
  if (path.length === 0) return next

  if (path.length === 1) {
    next.roots[path[0]] = block
    return next
  }

  const parentPath = path.slice(0, -1)
  const parent = getBlockByPath(next, parentPath)
  if (!parent) return next
  parent.children[path[path.length - 1]] = block
  return next
}

export function isWithin(block: Block, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < block.width && y < block.height
}

export function hitTest(block: Block, x: number, y: number): { kind: 'BlockChild'; index: number } | { kind: 'CellObj'; index: number } | null {
  // blocks first (topmost if later in list)
  for (let i = block.children.length - 1; i >= 0; i--) {
    const c = block.children[i]
    if (c.kind === 'Block') {
      if (x >= c.x && y >= c.y && x < c.x + c.width && y < c.y + c.height) return { kind: 'BlockChild', index: i }
    }
  }
  for (let i = block.children.length - 1; i >= 0; i--) {
    const c = block.children[i]
    if (c.kind === 'Block') continue
    if (c.x === x && c.y === y) return { kind: 'CellObj', index: i }
  }
  return null
}

export function listAllBlocks(level: Level): { id: number; path: number[] }[] {
  const out: { id: number; path: number[] }[] = []
  const walk = (b: Block, path: number[]) => {
    out.push({ id: b.id, path })
    b.children.forEach((c, idx) => {
      if (c.kind === 'Block') walk(c, [...path, idx])
    })
  }
  level.roots.forEach((r, i) => walk(r, [i]))
  return out.sort((a, b) => a.id - b.id)
}

export function findPathById(level: Level, id: number): number[] | null {
  const all = listAllBlocks(level)
  return all.find((b) => b.id === id)?.path ?? null
}

export function isObj(o: Obj, kind: Obj['kind']): boolean {
  return o.kind === kind
}
