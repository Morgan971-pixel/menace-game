import { describe, expect, it } from 'vitest'
import type { Cell } from '../engine/board'
import { boxKeys, createMenace, inspect, learn, type Menace } from '../engine/menace'
import { setBeads } from '../engine/testing'
import { beadsToDraw, drawnIndex, TRAY_CAP, trayLayout, trayTransition } from './trayLayout'

const EMPTY: Cell[] = Array<Cell>(9).fill(null)
const BOX1 = '         '
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
const real = (beads: readonly (number | null)[]) => beads.map((b) => b ?? 0)

/** Beads per square as the tray draws them. */
function drawnPerSquare(beads: readonly (number | null)[]): number[] {
  const out = Array<number>(9).fill(0)
  for (const b of trayLayout(beads).beads) out[b.square]++
  return out
}

function box1(m: Menace) {
  return inspect(m, EMPTY).beads
}

describe('the tray shows the real beads of real boxes', () => {
  it('fresh box 1: all 36 beads, 4 of every colour', () => {
    const beads = box1(createMenace())
    expect(real(beads)).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4])
    expect(drawnPerSquare(beads)).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4])
    expect(trayLayout(beads).scaled).toBe(false)
    expect(trayLayout(beads).tags).toEqual(Array.from({ length: 9 }, (_, square) => ({ square, count: 4 })))
  })

  it('box 1 after a loss on square 7: one pink bead fewer, and the drawing changes', () => {
    const m = createMenace()
    const before = drawnPerSquare(box1(m))
    learn(m, [{ boxKey: BOX1, canonMove: 6 }], 'O')
    const after = box1(m)
    expect(real(after)).toEqual([4, 4, 4, 4, 4, 4, 3, 4, 4])
    expect(drawnPerSquare(after)).toEqual(real(after))
    expect(drawnPerSquare(after)).not.toEqual(before)
    expect(after[6]).toBe(before[6] - 1)
  })

  it('a loss on square 7 keeps the grid: beads before the pink group stay exactly where they were', () => {
    const m = createMenace()
    const before = trayLayout(box1(m))
    learn(m, [{ boxKey: BOX1, canonMove: 6 }], 'O')
    const after = trayLayout(box1(m))
    expect(after.pitch).toBe(before.pitch)
    const firstPink = before.beads.findIndex((b) => b.square === 6)
    expect(after.beads.slice(0, firstPink)).toEqual(before.beads.slice(0, firstPink))
    expect(after.beads.filter((b) => b.square === 6)).toHaveLength(3)
  })

  it('box 1 after a win on square 1: three red beads more', () => {
    const m = createMenace()
    learn(m, [{ boxKey: BOX1, canonMove: 0 }], 'X')
    const after = box1(m)
    expect(real(after)).toEqual([7, 4, 4, 4, 4, 4, 4, 4, 4])
    expect(drawnPerSquare(after)).toEqual(real(after))
  })

  it('every fresh box in the cabinet is drawn bead for bead', () => {
    const m = createMenace()
    for (const key of boxKeys(m)) {
      const beads = [...m.boxes.get(key)!] // canonical counts; same multiset as the real squares
      expect(sum(beads)).toBeLessThanOrEqual(TRAY_CAP)
      expect(drawnPerSquare(beads)).toEqual(beads)
    }
  })

  it('a box grown up to the cap after many wins is still exact', () => {
    const m = createMenace()
    for (let g = 0; g < 18; g++) learn(m, [{ boxKey: BOX1, canonMove: 4 }], 'X') // centre: 4 + 54
    const beads = box1(m)
    expect(sum(real(beads))).toBe(90)
    expect(drawnPerSquare(beads)).toEqual(real(beads))
    expect(trayLayout(beads).scaled).toBe(false)
  })

  it('a box grown past the cap keeps proportions and tags every colour with its true count', () => {
    const m = createMenace()
    setBeads(m, BOX1, [61, 30, 9, 5, 2, 1, 0, 0, 12])
    const beads = box1(m)
    const r = real(beads)
    const total = sum(r)
    const layout = trayLayout(beads)
    const drawn = drawnPerSquare(beads)
    expect(layout.scaled).toBe(true)
    expect(sum(drawn)).toBe(TRAY_CAP)
    r.forEach((c, i) => {
      if (c === 0) expect(drawn[i]).toBe(0)
      else {
        expect(drawn[i]).toBeGreaterThanOrEqual(1)
        expect(Math.abs(drawn[i] - (c * TRAY_CAP) / total)).toBeLessThan(1)
      }
    })
    expect(layout.tags.map((t) => [t.square, t.count])).toEqual(
      r.flatMap((c, i) => (c > 0 ? [[i, c]] : [])),
    )
  })
})

describe('layout geometry', () => {
  it('no two beads share a spot, beads fit inside the tray, and bigger boxes pack tighter', () => {
    for (const n of [1, 9, 36, 60, 90]) {
      const beads = Array<number>(9).fill(0)
      for (let k = 0; k < n; k++) beads[k % 9]++
      const { beads: out, radius } = trayLayout(beads)
      expect(out).toHaveLength(n)
      expect(new Set(out.map((b) => `${b.x.toFixed(4)},${b.z.toFixed(4)}`)).size).toBe(n)
      for (const b of out) {
        expect(Math.abs(b.x) + radius).toBeLessThan(0.256) // inner tray wall
        expect(b.z + radius).toBeLessThan(0.428) // drawer front
        expect(b.z - radius).toBeGreaterThan(-0.23) // still outside the sleeve when open
      }
    }
    const r = (n: number) => trayLayout([n, 0, 0, 0, 0, 0, 0, 0, 0]).radius
    expect(r(20)).toBeGreaterThan(r(60))
    expect(r(60)).toBeGreaterThan(r(90))
  })

  it('groups by square, front row first, and draws the front-most bead of the chosen square', () => {
    const { beads } = trayLayout([2, null, 3, 0, 1, 0, 0, 0, 4])
    expect(beads.map((b) => b.square)).toEqual([0, 0, 2, 2, 2, 4, 8, 8, 8, 8])
    expect(beads[0].z).toBeGreaterThan(beads[beads.length - 1].z)
    expect(drawnIndex(beads, 4)).toBe(5)
    expect(drawnIndex(beads, 7)).toBe(-1)
  })

  it('beadsToDraw handles an empty box and a tiny cap', () => {
    expect(sum(beadsToDraw([0, 0, null, 0, 0, 0, 0, 0, 0]))).toBe(0)
    expect(beadsToDraw([5, 5, 5, 0, 0, 0, 0, 0, 0], 2)).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('trayTransition', () => {
  const box = [4, 3, 4, 4, 4, 4, 4, 4, 4]

  it('a win adds three beads of the colour: three drop in, none leave, the rest stay', () => {
    const after = box.slice()
    after[6] += 3
    const { moves } = trayTransition(box, after)
    expect(moves.filter((m) => m.from === null).map((m) => m.square)).toEqual([6, 6, 6])
    expect(moves.filter((m) => m.to === null)).toHaveLength(0)
    expect(moves.filter((m) => m.from !== null && m.to !== null)).toHaveLength(35)
  })

  it('a loss removes one bead of the colour; the groups behind it close up one slot', () => {
    const after = box.slice()
    after[6] -= 1
    const { moves } = trayTransition(box, after)
    const left = moves.filter((m) => m.to === null)
    expect(left).toHaveLength(1)
    expect(left[0].square).toBe(6)
    const lb = trayLayout(box)
    const la = trayLayout(after)
    const stay = moves.filter((m) => m.from !== null && m.to !== null)
    expect(stay).toHaveLength(la.beads.length)
    // every staying bead ends exactly where the after layout draws a bead of its colour
    expect(stay.map((m) => `${m.square}:${m.to!.x}:${m.to!.z}`).sort()).toEqual(
      la.beads.map((b) => `${b.square}:${b.x}:${b.z}`).sort(),
    )
    expect(lb.beads.length - la.beads.length).toBe(1)
  })

  it('moves cover the before layout and the after layout exactly', () => {
    const after = [4, 3, 4, 4, 7, 4, 4, 4, 0]
    const t = trayTransition(box, after)
    expect(t.moves.filter((m) => m.from !== null)).toHaveLength(trayLayout(box).beads.length)
    expect(t.moves.filter((m) => m.to !== null)).toHaveLength(trayLayout(after).beads.length)
  })

  it('no change: every bead stays in place', () => {
    const { moves } = trayTransition(box, box)
    expect(moves.every((m) => m.from !== null && m.to !== null && m.from.x === m.to.x && m.from.z === m.to.z)).toBe(true)
  })
})
