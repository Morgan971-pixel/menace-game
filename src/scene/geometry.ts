// Shared measurements, placements and helpers for the study scene.
import { CanvasTexture, Euler, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from 'three'

export type V3 = [number, number, number]

export interface Placement {
  position: V3
  /** Applied yaw first, then pitch (Euler order YXZ). */
  rotation?: V3
  scale?: number
}

export interface BoardPlacement extends Placement {
  cell: number
}

/** One matchbox in cabinet units. */
export const BOX = { w: 0.6, h: 0.3, d: 0.9, gap: 0.05 }

/** The cabinet is a grid of slots, read row by row from the top-left. */
export interface Grid {
  cols: number
  rows: number
}
/** 1961 rules: 16 x 19 = 304 slots, one per box. */
export const GRID_1961: Grid = { cols: 16, rows: 19 }
/** Engine rules: 18 x 19 = 342 slots for the 338 boxes it can grow (4 spare). */
export const GRID_ENGINE: Grid = { cols: 18, rows: 19 }
export const gridFor = (rules: '1961' | 'engine'): Grid => (rules === 'engine' ? GRID_ENGINE : GRID_1961)

export const COLS = GRID_1961.cols
export const ROWS = GRID_1961.rows
/** Slots of the 1961 cabinet (304). */
export const SLOTS = COLS * ROWS
/** Slots of the largest cabinet; the instanced mesh is built for this many. */
export const MAX_SLOTS = GRID_ENGINE.cols * GRID_ENGINE.rows

export function cabinetSize(g: Grid): { w: number; h: number } {
  return { w: g.cols * (BOX.w + BOX.gap) + BOX.gap, h: g.rows * (BOX.h + BOX.gap) + BOX.gap }
}
export const CABINET = cabinetSize(GRID_1961)

/** Bead radius in box units. Large on purpose so the tray reads on a phone. */
export const BEAD_R = 0.043

/** One colour per real square, index 0 = top-left. No orange. */
export const BEAD_COLORS = [
  '#d1495b', // 1 red
  '#edae49', // 2 gold
  '#3c9d5d', // 3 green
  '#00798c', // 4 teal
  '#3066be', // 5 blue
  '#7b4fa3', // 6 purple
  '#e07a9f', // 7 pink
  '#f2efe6', // 8 white
  '#2b2b2b', // 9 black
] as const

export const PALETTE = {
  wall: '#1d3b40',
  night: '#0b1517',
  desk: '#3a2a1f',
  paper: '#efe6d2',
  ink: '#1f2a30',
  brick: '#a8322d',
  teal: '#1d4e52',
  boxFace: '#e9dfc7',
  boxSide: '#c9b48e',
  tray: '#e3d6b8',
  frame: '#2c1b10',
  /** Warm-neutral lamp light: a little above white, never orange. */
  lamp: '#fff3e2',
  moon: '#9cc7d0',
} as const

// World placements (metres-ish). The desk top is y = 0. Board and box placements: layout.ts.
export const CABINET_AT: Placement = { position: [0.55, 0, -1.86], scale: 0.155 }

/** The engine cabinet is two columns wider; it sits a little further right so it clears the title text. */
export const cabinetAt = (rules: '1961' | 'engine'): Placement =>
  rules === 'engine' ? { ...CABINET_AT, position: [CABINET_AT.position[0] + 0.2, CABINET_AT.position[1], CABINET_AT.position[2]] } : CABINET_AT

export const euler = (p: Placement) => new Euler(...(p.rotation ?? [0, 0, 0]), 'YXZ')

export function toMatrix(p: Placement): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...p.position),
    new Quaternion().setFromEuler(euler(p)),
    new Vector3().setScalar(p.scale ?? 1),
  )
}

/** Cabinet-local centre of slot i. Slot 0 (box 1) is top-left, reading row by row. */
export function slotLocal(i: number, g: Grid = GRID_1961): Vector3 {
  const c = i % g.cols
  const r = Math.floor(i / g.cols)
  return new Vector3(
    (c - (g.cols - 1) / 2) * (BOX.w + BOX.gap),
    BOX.gap + (g.rows - 1 - r) * (BOX.h + BOX.gap) + BOX.h / 2,
    0,
  )
}

export function squareLocal(i: number, cell: number): Vector3 {
  return new Vector3(((i % 3) - 1) * cell, 0, (Math.floor(i / 3) - 1) * cell)
}

/** Where a mark sits inside its square: nudged off the corner label (number and colour dot). */
export function markOffset(cell: number): V3 {
  return [cell * 0.04, 0, cell * 0.05]
}

/** World point where the mark on square i is drawn; the drawn bead lands exactly here. */
export function markWorld(i: number, b: BoardPlacement): Vector3 {
  const [x, y, z] = markOffset(b.cell)
  return squareLocal(i, b.cell).add(new Vector3(x, y, z)).applyMatrix4(toMatrix(b))
}

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** Matchbox label: "MENACE" and, when given, the box number. */
export function makeLabelTexture(sub?: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  if (!g) throw new Error('2D canvas is not available for the matchbox label')
  g.fillStyle = PALETTE.boxFace
  g.fillRect(0, 0, 256, 128)
  g.strokeStyle = PALETTE.ink
  g.lineWidth = 5
  g.strokeRect(10, 10, 236, 108)
  g.lineWidth = 1.5
  g.strokeRect(18, 18, 220, 92)
  g.fillStyle = PALETTE.teal
  for (let i = 0; i < 6; i++) {
    g.fillRect(26 + i * 8, 26, 4, 76)
    g.fillRect(206 + i * 4, 26, 2, 76)
  }
  g.fillStyle = PALETTE.ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 30px Georgia, serif'
  g.fillText('MENACE', 135, sub ? 52 : 64)
  if (sub) {
    g.font = '700 30px Georgia, serif'
    g.fillText(sub, 135, 88)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** The dish of confiscated beads: radius of its top, height of its rim, bead radius (world units). */
export const DISH = { r: 0.2, h: 0.05, bead: 0.024 }
/** Beads per layer in the dish, and how many layers are drawn before the top layer just refills. */
const DISH_LAYER = 12
const DISH_LAYERS = 4

/** Dish-local resting spot of the k-th confiscated bead: a sunflower spiral, layer on layer. */
export function dishSpot(k: number): Vector3 {
  const n = Math.min(k, DISH_LAYER * DISH_LAYERS - 1)
  const layer = Math.floor(n / DISH_LAYER)
  const j = n % DISH_LAYER
  const rad = (DISH.r - DISH.bead * 1.6) * Math.sqrt((j + 0.5) / DISH_LAYER)
  const a = j * 2.39996 + layer * 0.9
  return new Vector3(Math.cos(a) * rad, DISH.h + DISH.bead + layer * DISH.bead * 1.3, Math.sin(a) * rad)
}
