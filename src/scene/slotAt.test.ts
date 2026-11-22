import { describe, expect, it } from 'vitest'
import { GRID_ENGINE, MAX_SLOTS, slotLocal, SLOTS } from './geometry'
import { slotAt } from './slotAt'

describe('slotAt', () => {
  it('maps every slot centre back to its own slot', () => {
    for (let i = 0; i < SLOTS; i++) {
      const c = slotLocal(i)
      expect(slotAt(c.x, c.y, SLOTS)).toBe(i)
    }
  })
  it('a point in the gap or past the edge still picks the nearest slot', () => {
    const c = slotLocal(37)
    expect(slotAt(c.x + 0.33, c.y - 0.16, SLOTS)).toBeGreaterThanOrEqual(0)
    expect(slotAt(-99, 99, SLOTS)).toBe(0)
    expect(slotAt(99, -99, SLOTS)).toBe(SLOTS - 1)
  })
})

describe('slotAt on the engine cabinet (18 x 19)', () => {
  it('maps every one of its 342 slot centres back to its own slot', () => {
    expect(MAX_SLOTS).toBe(342)
    for (let i = 0; i < MAX_SLOTS; i++) {
      const c = slotLocal(i, GRID_ENGINE)
      expect(slotAt(c.x, c.y, MAX_SLOTS, GRID_ENGINE)).toBe(i)
    }
  })
  it('slots 304 to 337 sit in the lower rows and never overlap an earlier slot', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 338; i++) {
      const c = slotLocal(i, GRID_ENGINE)
      const k = `${c.x.toFixed(3)},${c.y.toFixed(3)}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
    }
    expect(slotLocal(337, GRID_ENGINE).y).toBeLessThan(slotLocal(0, GRID_ENGINE).y)
  })
  it('clamps to the count it is given', () => {
    expect(slotAt(99, -99, 338, GRID_ENGINE)).toBe(337)
  })
})
