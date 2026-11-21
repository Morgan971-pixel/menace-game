// The mirror: a second learning machine that plays O with MENACE's bead rules.
// Boxes are made on demand, one per position with O to move (merged by symmetry like MENACE's),
// each square starts with 4 beads, and a game moves the drawn beads by +3 win, +1 draw, -1 loss
// from O's side. The floor is 1, so a mirror box never empties and the mirror never resigns.
import { canonicalize, type Cells, type Result } from './board'
import type { Opponent } from './opponents'
import type { Rng } from './rng'

export const MIRROR_START_BEADS = 4
export const MIRROR_FLOOR = 1
const REWARD = { win: 3, draw: 1, loss: -1 } as const

export interface Mirror extends Opponent {
  /** Canonical key (O to move) -> beads per canonical square. Read-only for consumers. */
  readonly boxes: ReadonlyMap<string, readonly number[]>
}

export function createMirror(): Mirror {
  const boxes = new Map<string, number[]>()
  let history: { key: string; canonMove: number }[] = []

  return {
    name: 'Itself',
    boxes,
    move(cells: Cells, rng: Rng): number {
      const { key, perm } = canonicalize(cells)
      let box = boxes.get(key)
      if (box === undefined) {
        box = [...key].map((c) => (c === ' ' ? MIRROR_START_BEADS : 0))
        boxes.set(key, box)
      }
      const total = box.reduce((a, b) => a + b, 0)
      if (total === 0) throw new Error('mirror.move: the board is full')
      let r = rng() * total
      let canonMove = box.findIndex((b) => b > 0)
      for (let i = 0; i < box.length; i++) {
        if (box[i] === 0) continue
        canonMove = i
        if (r < box[i]) break
        r -= box[i]
      }
      history.push({ key, canonMove })
      // Canonical square k came from real square perm[k], as in chooseMove.
      return perm[canonMove]
    },
    finish(result: Result): void {
      const delta = result === 'O' ? REWARD.win : result === 'D' ? REWARD.draw : REWARD.loss
      for (const { key, canonMove } of history) {
        const box = boxes.get(key)
        if (box) box[canonMove] = Math.max(MIRROR_FLOOR, box[canonMove] + delta)
      }
      history = []
    },
  }
}
