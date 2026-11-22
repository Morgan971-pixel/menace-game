import { describe, expect, it } from 'vitest'
import { boxKeys, chooseMove, createMenace, defaultConfig } from './menace'
import { seeded } from './rng'
import { randomOpponent } from './opponents'
import { playGame } from './trainer'
import { ALL_KEYS, isSlotKey, keyAtSlot, slotCount, slotMade, slotOfKey } from './slots'

describe('cabinet slots', () => {
  it('has 338 positions: the 304 of moves 1 to 4 plus the 34 of move 5', () => {
    expect(ALL_KEYS.length).toBe(338)
    expect(new Set(ALL_KEYS).size).toBe(338)
    expect(slotCount('1961')).toBe(304)
    expect(slotCount('engine')).toBe(338)
  })

  it('the first 304 slots are exactly the 1961 boxes, in the same order', () => {
    expect(ALL_KEYS.slice(0, 304)).toEqual([...boxKeys(createMenace())])
  })

  it('slot numbers are permanent: a lazy box keeps its slot as others are made', () => {
    const m = createMenace(defaultConfig('engine'))
    expect(m.boxes.size).toBe(0)
    const rng = seeded(5)
    const slotOf = new Map<string, number>()
    for (let g = 0; g < 400; g++) {
      playGame(m, randomOpponent, rng)
      for (const key of m.boxes.keys()) {
        const slot = slotOfKey(key)
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(338)
        expect(ALL_KEYS[slot]).toBe(key)
        if (slotOf.has(key)) expect(slotOf.get(key)).toBe(slot)
        slotOf.set(key, slot)
      }
    }
    expect(m.boxes.size).toBeGreaterThan(100)
    expect(m.boxes.size).toBeLessThanOrEqual(338)
    // The engine's own index shifts as boxes appear, which is why the cabinet does not use it.
    const first = [...m.boxes.keys()][0]
    expect(keyAtSlot(m, slotOfKey(first))).toBe(first)
  })

  it('slots above 303 hold the move-5 boxes the engine rules make', () => {
    const m = createMenace(defaultConfig('engine'))
    const rng = seeded(11)
    for (let g = 0; g < 3000; g++) playGame(m, randomOpponent, rng)
    // Random play meets nearly every position but not all of them in 3,000 games.
    expect(m.boxes.size).toBeGreaterThan(300)
    expect(m.boxes.size).toBeLessThanOrEqual(338)
    expect(ALL_KEYS.slice(304).filter((_, i) => slotMade(m, 304 + i)).length).toBeGreaterThan(20)
    for (const key of m.boxes.keys()) expect(isSlotKey(key)).toBe(true)
  })

  it('an unmade slot, an out-of-range slot and a stray key are reported as such', () => {
    const m = createMenace(defaultConfig('engine'))
    expect(slotMade(m, 0)).toBe(false)
    expect(keyAtSlot(m, 999)).toBeUndefined()
    expect(slotOfKey('XXXXXXXXX')).toBe(-1)
    expect(isSlotKey('XXXXXXXXX')).toBe(false)
    chooseMove(m, Array(9).fill(null), seeded(1))
    expect(slotMade(m, 0)).toBe(true)
  })
})
