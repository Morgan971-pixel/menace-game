// PROTOTYPE: shared measurements and transforms for the cabinet, box and board.
import { CanvasTexture, Euler, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from 'three'

export type V3 = [number, number, number]
export interface Placement {
  position: V3
  rotation?: V3 // applied yaw first, then pitch (Euler order YXZ)
  scale?: number
}
export interface BoardPlacement extends Placement {
  cell: number
}

export const BOX = { w: 0.6, h: 0.3, d: 0.9, gap: 0.05 }
export const COLS = 16
export const ROWS = 19 // 16 x 19 = 304
export const CABINET = {
  w: COLS * (BOX.w + BOX.gap) + BOX.gap,
  h: ROWS * (BOX.h + BOX.gap) + BOX.gap,
}
export const BEAD_R = 0.036

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
]

export const euler = (p: Placement) => new Euler(...(p.rotation ?? [0, 0, 0]), 'YXZ')

export function toMatrix(p: Placement): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...p.position),
    new Quaternion().setFromEuler(euler(p)),
    new Vector3().setScalar(p.scale ?? 1),
  )
}

export function slotLocal(i: number): Vector3 {
  const c = i % COLS
  const r = Math.floor(i / COLS)
  return new Vector3(
    (c - (COLS - 1) / 2) * (BOX.w + BOX.gap),
    BOX.gap + r * (BOX.h + BOX.gap) + BOX.h / 2,
    0,
  )
}

export function squareLocal(i: number, cell: number): Vector3 {
  return new Vector3(((i % 3) - 1) * cell, 0, (Math.floor(i / 3) - 1) * cell)
}

export function squareWorld(i: number, b: BoardPlacement): Vector3 {
  return squareLocal(i, b.cell).applyMatrix4(toMatrix(b))
}

export function beadSpot(k: number): V3 {
  const cols = 6
  const c = k % cols
  const r = Math.floor(k / cols)
  return [(c - (cols - 1) / 2) * 0.085, 0, 0.36 - r * 0.085]
}

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

export function makeLabelTexture(opts: { bg: string; ink: string; accent: string; title?: string; sub?: string }) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = opts.bg
  g.fillRect(0, 0, 256, 128)
  g.strokeStyle = opts.ink
  g.lineWidth = 5
  g.strokeRect(10, 10, 236, 108)
  g.lineWidth = 1.5
  g.strokeRect(18, 18, 220, 92)
  g.fillStyle = opts.accent
  for (let i = 0; i < 6; i++) {
    g.fillRect(26 + i * 8, 26, 4, 76)
    g.fillRect(206 + i * 4, 26, 2, 76)
  }
  g.fillStyle = opts.ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 30px Georgia, serif'
  g.fillText(opts.title ?? 'MENACE', 135, opts.sub ? 56 : 64)
  if (opts.sub) {
    g.font = '600 22px Georgia, serif'
    g.fillText(opts.sub, 135, 88)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}
