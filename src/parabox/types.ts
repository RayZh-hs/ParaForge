export type LevelHeader = {
  version: number
  attempt_order?: string
  shed?: boolean
  inner_push?: boolean
  draw_style?: 'tui' | 'grid' | 'oldstyle'
  custom_level_music?: number
  custom_level_palette?: number
  unknown: string[]
}

export type Block = {
  kind: 'Block'
  x: number
  y: number
  id: number
  width: number
  height: number
  hue: number
  sat: number
  val: number
  zoomfactor: number
  fillwithwalls: 0 | 1
  player: 0 | 1
  possessable: 0 | 1
  playerorder: number
  fliph: 0 | 1
  floatinspace: 0 | 1
  specialeffect: number
  children: Obj[]
}

export type Ref = {
  kind: 'Ref'
  x: number
  y: number
  id: number
  exitblock: 0 | 1
  infexit: 0 | 1
  infexitnum: number
  infenter: 0 | 1
  infenternum: number
  infenterid: number
  player: 0 | 1
  possessable: 0 | 1
  playerorder: number
  fliph: 0 | 1
  floatinspace: 0 | 1
  specialeffect: number
}

export type Wall = {
  kind: 'Wall'
  x: number
  y: number
  player: 0 | 1
  possessable: 0 | 1
  playerorder: number
}

export type FloorType =
  | { kind: 'Button' }
  | { kind: 'PlayerButton' }
  | { kind: 'Portal'; sceneName: string }
  | { kind: 'Info'; text: string }
  | { kind: 'Break' }
  | { kind: 'FastTravel' }
  | { kind: 'Gallery' }
  | { kind: 'DemoEnd' }
  | { kind: 'Unknown'; raw: string }

export type Floor = {
  kind: 'Floor'
  x: number
  y: number
  type: FloorType
}

export type Obj = Block | Ref | Wall | Floor

export type Level = {
  header: LevelHeader
  roots: Block[]
}

export function createEmptyLevel(): Level {
  return {
    header: {
      version: 4,
      unknown: [],
    },
    roots: [
      {
        kind: 'Block',
        x: -1,
        y: -1,
        id: 0,
        width: 9,
        height: 9,
        hue: 0.6,
        sat: 0.8,
        val: 1,
        zoomfactor: 1,
        fillwithwalls: 0,
        player: 0,
        possessable: 0,
        playerorder: 0,
        fliph: 0,
        floatinspace: 0,
        specialeffect: 0,
        children: [],
      },
    ],
  }
}
