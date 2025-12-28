import type { Block, Floor, FloorType, Level, LevelHeader, Obj, Ref, Wall } from './types'

export class ParseError extends Error {
  line: number
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`)
    this.name = 'ParseError'
    this.line = line
  }
}

function toInt(token: string | undefined, fallback = 0): number {
  if (token == null) return fallback
  const n = Number(token)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toFloat(token: string | undefined, fallback = 0): number {
  if (token == null) return fallback
  const n = Number(token)
  return Number.isFinite(n) ? n : fallback
}

function toBool01(token: string | undefined, fallback: 0 | 1 = 0): 0 | 1 {
  const n = toInt(token, fallback)
  return n === 1 ? 1 : 0
}

export function parseLevel(text: string): Level {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const lines = rawLines.map((l) => l.replace(/[ \t]+$/g, ''))

  const header: LevelHeader = { version: 4, unknown: [] }

  let i = 0
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    if (line.trim() === '#') {
      i++
      break
    }
    const tokens = line.trim().split(/\s+/g)
    const key = tokens[0]
    if (key === 'version') {
      const v = Number(tokens[1])
      if (!Number.isFinite(v)) throw new ParseError('Invalid version', i + 1)
      header.version = Math.trunc(v)
    } else if (key === 'attempt_order') {
      header.attempt_order = tokens.slice(1).join(' ')
    } else if (key === 'shed') {
      header.shed = true
    } else if (key === 'inner_push') {
      header.inner_push = true
    } else if (key === 'draw_style') {
      const style = tokens[1]
      if (style === 'tui' || style === 'grid' || style === 'oldstyle') header.draw_style = style
      else header.unknown.push(line)
    } else if (key === 'custom_level_music') {
      header.custom_level_music = toInt(tokens[1], -1)
    } else if (key === 'custom_level_palette') {
      header.custom_level_palette = toInt(tokens[1], -1)
    } else {
      header.unknown.push(line)
    }
  }

  if (!Number.isFinite(header.version)) throw new ParseError('Missing version header', 1)

  const roots: Block[] = []
  const stack: Block[] = []

  for (; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '') continue

    const match = raw.match(/^(\t*)(.*)$/)
    if (!match) continue
    const depth = match[1].length
    const content = match[2].trim()
    if (!content) continue

    const tokens = content.split(/\s+/g)
    const kind = tokens[0]

    while (stack.length > depth) stack.pop()
    if (depth > stack.length) {
      throw new ParseError('Invalid indentation (no parent block at that depth)', i + 1)
    }

    const parent = stack[stack.length - 1]

    const obj = parseObject(kind, tokens.slice(1), i + 1)

    if (obj.kind === 'Block') {
      if (parent) parent.children.push(obj)
      else roots.push(obj)
      stack.push(obj)
    } else {
      if (!parent) throw new ParseError(`${obj.kind} must be inside a Block`, i + 1)
      parent.children.push(obj)
    }
  }

  if (roots.length === 0) throw new ParseError('No root Block found', lines.length)

  return { header, roots }
}

function parseObject(kind: string, args: string[], line: number): Obj {
  if (kind === 'Block') {
    return {
      kind: 'Block',
      x: toInt(args[0]),
      y: toInt(args[1]),
      id: toInt(args[2]),
      width: toInt(args[3], 1),
      height: toInt(args[4], 1),
      hue: toFloat(args[5], 0.6),
      sat: toFloat(args[6], 0.8),
      val: toFloat(args[7], 1),
      zoomfactor: toFloat(args[8], 1),
      fillwithwalls: toBool01(args[9]),
      player: toBool01(args[10]),
      possessable: toBool01(args[11]),
      playerorder: toInt(args[12]),
      fliph: toBool01(args[13]),
      floatinspace: toBool01(args[14]),
      specialeffect: toInt(args[15]),
      children: [],
    }
  }

  if (kind === 'Ref') {
    const ref: Ref = {
      kind: 'Ref',
      x: toInt(args[0]),
      y: toInt(args[1]),
      id: toInt(args[2]),
      exitblock: toBool01(args[3]),
      infexit: toBool01(args[4]),
      infexitnum: toInt(args[5]),
      infenter: toBool01(args[6]),
      infenternum: toInt(args[7]),
      infenterid: toInt(args[8], -1),
      player: toBool01(args[9]),
      possessable: toBool01(args[10]),
      playerorder: toInt(args[11]),
      fliph: toBool01(args[12]),
      floatinspace: toBool01(args[13]),
      specialeffect: toInt(args[14]),
    }
    return ref
  }

  if (kind === 'Wall') {
    const wall: Wall = {
      kind: 'Wall',
      x: toInt(args[0]),
      y: toInt(args[1]),
      player: toBool01(args[2]),
      possessable: toBool01(args[3]),
      playerorder: toInt(args[4]),
    }
    return wall
  }

  if (kind === 'Floor') {
    const x = toInt(args[0])
    const y = toInt(args[1])
    const rest = args.slice(2).join(' ')
    return {
      kind: 'Floor',
      x,
      y,
      type: parseFloorType(rest),
    }
  }

  throw new ParseError(`Unknown object kind: ${kind}`, line)
}

function parseFloorType(raw: string): FloorType {
  const tokens = raw.split(/\s+/g).filter(Boolean)
  const head = tokens[0]

  if (!head) return { kind: 'Unknown', raw: '' }
  if (head === 'Button') return { kind: 'Button' }
  if (head === 'PlayerButton') return { kind: 'PlayerButton' }
  if (head === 'Break') return { kind: 'Break' }
  if (head === 'FastTravel') return { kind: 'FastTravel' }
  if (head === 'Gallery') return { kind: 'Gallery' }
  if (head === 'DemoEnd') return { kind: 'DemoEnd' }

  if (head === 'Portal') {
    const sceneName = tokens.slice(1).join(' ') || ''
    return { kind: 'Portal', sceneName }
  }

  if (head === 'Info') {
    const text = tokens
      .slice(1)
      .join(' ')
      .replace(/_/g, ' ')
    return { kind: 'Info', text }
  }

  return { kind: 'Unknown', raw }
}

export function serializeLevel(level: Level): string {
  const out: string[] = []

  out.push(`version ${level.header.version}`)
  if (level.header.attempt_order) out.push(`attempt_order ${level.header.attempt_order}`)
  if (level.header.shed) out.push('shed')
  if (level.header.inner_push) out.push('inner_push')
  if (level.header.draw_style) out.push(`draw_style ${level.header.draw_style}`)
  if (level.header.custom_level_music != null) out.push(`custom_level_music ${level.header.custom_level_music}`)
  if (level.header.custom_level_palette != null) out.push(`custom_level_palette ${level.header.custom_level_palette}`)
  for (const u of level.header.unknown) out.push(u)
  out.push('#')

  for (const root of level.roots) {
    emitObj(out, root, 0)
  }

  return out.join('\n') + '\n'
}

function emitObj(out: string[], obj: Obj, depth: number): void {
  const indent = '\t'.repeat(depth)
  if (obj.kind === 'Block') {
    out.push(
      `${indent}Block ${obj.x} ${obj.y} ${obj.id} ${obj.width} ${obj.height} ${fmt(obj.hue)} ${fmt(obj.sat)} ${fmt(obj.val)} ${fmt(obj.zoomfactor)} ${obj.fillwithwalls} ${obj.player} ${obj.possessable} ${obj.playerorder} ${obj.fliph} ${obj.floatinspace} ${obj.specialeffect}`,
    )
    for (const child of obj.children) emitObj(out, child, depth + 1)
    return
  }

  if (obj.kind === 'Ref') {
    out.push(
      `${indent}Ref ${obj.x} ${obj.y} ${obj.id} ${obj.exitblock} ${obj.infexit} ${obj.infexitnum} ${obj.infenter} ${obj.infenternum} ${obj.infenterid} ${obj.player} ${obj.possessable} ${obj.playerorder} ${obj.fliph} ${obj.floatinspace} ${obj.specialeffect}`,
    )
    return
  }

  if (obj.kind === 'Wall') {
    out.push(`${indent}Wall ${obj.x} ${obj.y} ${obj.player} ${obj.possessable} ${obj.playerorder}`)
    return
  }

  if (obj.kind === 'Floor') {
    out.push(`${indent}Floor ${obj.x} ${obj.y} ${formatFloorType(obj)}`)
    return
  }

  // exhaustive
  const _never: never = obj
  return _never
}

function formatFloorType(floor: Floor): string {
  const t = floor.type
  if (t.kind === 'Button') return 'Button'
  if (t.kind === 'PlayerButton') return 'PlayerButton'
  if (t.kind === 'Portal') return `Portal ${t.sceneName}`.trimEnd()
  if (t.kind === 'Info') return `Info ${t.text.replace(/ /g, '_')}`.trimEnd()
  if (t.kind === 'Break') return 'Break'
  if (t.kind === 'FastTravel') return 'FastTravel'
  if (t.kind === 'Gallery') return 'Gallery'
  if (t.kind === 'DemoEnd') return 'DemoEnd'
  return t.raw
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const s = String(n)
  if (s.includes('e') || s.includes('E')) return n.toFixed(6).replace(/0+$/g, '').replace(/\.$/g, '')
  return s
}
