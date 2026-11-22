import { describe, expect, it } from 'vitest'
import { DISH_TAIL, MAX_DISH_COUNT, addToDish, dishTotal, emptyDish, parseDish } from './dish'

describe('dish', () => {
  it('starts empty', () => {
    expect(emptyDish()).toEqual({ counts: Array(9).fill(0), tail: [] })
    expect(dishTotal(emptyDish())).toBe(0)
  })

  it('counts every bead and keeps the last 48 squares as the tail', () => {
    let d = emptyDish()
    for (let i = 0; i < 100; i++) d = addToDish(d, i % 9, 1)
    expect(dishTotal(d)).toBe(100)
    expect(d.tail).toHaveLength(DISH_TAIL)
    // the last 48 of 0,1,2,...,8,0,1,... (100 beads): bead k has square k % 9
    expect(d.tail).toEqual(Array.from({ length: 48 }, (_, j) => (52 + j) % 9))
    expect(d.counts.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('does not mutate the dish it was given', () => {
    const d = emptyDish()
    addToDish(d, 3, 2)
    expect(d).toEqual(emptyDish())
  })

  it('never builds anything sized by the bead count', () => {
    const d = addToDish(emptyDish(), 4, 1e300)
    expect(d.tail).toHaveLength(DISH_TAIL)
    expect(d.counts[4]).toBe(MAX_DISH_COUNT)
    expect(addToDish(emptyDish(), 4, 0)).toEqual(emptyDish())
    expect(addToDish(emptyDish(), 4, -3)).toEqual(emptyDish())
  })

  it('parses the saved shape, clamping instead of rejecting', () => {
    const d = parseDish({ counts: [1, 2, 3, 4, 5, 6, 7, 8, 1e30], tail: [0, 1, 99, -1, 2.5, 'x', 8] })
    expect(d.counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, MAX_DISH_COUNT])
    expect(d.tail).toEqual([0, 1, 8])
    expect(parseDish({ counts: [1, 2], tail: Array(500).fill(3) }).counts).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(parseDish({ counts: [], tail: Array(500).fill(3) }).tail).toHaveLength(DISH_TAIL)
    expect(parseDish({ counts: [-5, 1.5, NaN], tail: [] }).counts).toEqual(Array(9).fill(0))
  })

  it('migrates the old format, a plain list of squares', () => {
    const old = Array.from({ length: 300_000 }, (_, i) => i % 9)
    const d = parseDish(old)
    expect(dishTotal(d)).toBe(300_000)
    expect(d.counts[0]).toBe(33334)
    expect(d.tail).toHaveLength(DISH_TAIL)
    expect(d.tail).toEqual(old.slice(-DISH_TAIL))
  })

  it('turns garbage into an empty dish', () => {
    for (const v of [null, undefined, 'beads', 12, true, {}, { counts: 'x' }]) expect(parseDish(v)).toEqual(emptyDish())
  })
})
