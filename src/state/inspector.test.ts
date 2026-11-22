import { describe, expect, it } from 'vitest'
import { canonicalize } from '../engine/board'
import { boxIndex, boxKeys, chooseMove, createMenace, defaultConfig, inspect, learn, moveNumber } from '../engine/menace'
import { seeded } from '../engine/rng'
import { setBeads } from '../engine/testing'
import { SLOTS } from '../scene/geometry'
import { ALL_KEYS } from '../engine/slots'
import { boxView, canInspect, keyCells, shareLabel, stepSlot } from './inspector'

describe('boxView', () => {
  const m = createMenace()
  const keys = boxKeys(m)

  it('the cabinet has 304 slots and each maps to its own key', () => {
    expect(keys.length).toBe(SLOTS)
    for (let i = 0; i < SLOTS; i++) {
      const v = boxView(m, i)
      expect(v).not.toBeNull()
      expect(v?.key).toBe(keys[i])
      expect(v?.number).toBe(i + 1)
      expect(boxIndex(m, v?.key ?? '')).toBe(i)
      expect(v?.cells.length).toBe(9)
    }
    expect(boxView(m, -1)).toBeNull()
    expect(boxView(m, SLOTS)).toBeNull()
  })

  it('shows exactly the beads inspect() reports for a fresh brain, with the right move number', () => {
    for (let i = 0; i < SLOTS; i++) {
      const v = boxView(m, i)!
      const beads = inspect(m, keyCells(keys[i])).beads
      expect(v.squares.map((s) => s.count)).toEqual(v.squares.map((s) => beads[s.square]))
      expect(v.squares.every((s) => v.cells[s.square] === null)).toBe(true)
      expect(v.move).toBe(moveNumber(v.cells))
      expect(v.total).toBe(v.started)
      expect(v.total).toBe(m.config.startBeads[v.move - 1] * v.squares.length)
      expect(v.squares.reduce((a, s) => a + s.share, 0)).toBe(100)
    }
  })

  it('first box is a move-1 box with 36 beads', () => {
    const v = boxView(m, 0)!
    expect(v.move).toBe(1)
    expect(v.total).toBe(36)
    expect(v.started).toBe(36)
  })

  it('follows learn: the counts equal inspect afterwards and shares still sum to 100', () => {
    const brain = createMenace()
    const slot = 100
    const key = boxKeys(brain)[slot]
    const cells = keyCells(key)
    const before = boxView(brain, slot)!
    const square = before.squares[0].square
    const canonMove = [...key].findIndex((c, k) => c === ' ' && canonicalize(cells).perm[k] === square)
    learn(brain, [{ boxKey: key, canonMove }], 'X')
    const after = boxView(brain, slot)!
    const beads = inspect(brain, cells).beads
    expect(after.squares.map((s) => s.count)).toEqual(after.squares.map((s) => beads[s.square]))
    expect(after.total).toBe(before.total + brain.config.rewards.win)
    expect(after.started).toBe(before.started)
    expect(after.squares.reduce((a, s) => a + s.share, 0)).toBe(100)
  })

  it('reports an empty box as zeros with zero shares', () => {
    const brain = createMenace()
    const key = boxKeys(brain)[5]
    brain.boxes.get(key)!.forEach((_, i, arr) => {
      ;(arr as number[])[i] = 0
    })
    const v = boxView(brain, 5)!
    expect(v.total).toBe(0)
    expect(v.squares.every((s) => s.count === 0 && s.share === 0)).toBe(true)
  })
})

describe('stepSlot', () => {
  it('moves by 1 and by one row of 16, and stays in range', () => {
    expect(stepSlot(10, 'ArrowRight', 304)).toBe(11)
    expect(stepSlot(10, 'ArrowLeft', 304)).toBe(9)
    expect(stepSlot(10, 'ArrowDown', 304)).toBe(26)
    expect(stepSlot(20, 'ArrowUp', 304)).toBe(4)
    expect(stepSlot(0, 'ArrowLeft', 304)).toBe(0)
    expect(stepSlot(3, 'ArrowUp', 304)).toBe(3)
    expect(stepSlot(300, 'ArrowDown', 304)).toBe(300)
    expect(stepSlot(50, 'Home', 304)).toBe(0)
    expect(stepSlot(50, 'End', 304)).toBe(303)
  })
})

describe('canInspect', () => {
  it('only between games, or in the ledger with a box on show', () => {
    expect(canInspect('title', false, false)).toBe(true)
    expect(canInspect('over', false, false)).toBe(true)
    expect(canInspect('menace', false, false)).toBe(false)
    expect(canInspect('player', false, false)).toBe(false)
    expect(canInspect('ledger', false, false)).toBe(false)
    expect(canInspect('ledger', false, true)).toBe(true)
    expect(canInspect('title', true, false)).toBe(false)
  })
})

describe('shareLabel', () => {
  it('shows the whole percent, and "<1%" for a real but tiny share', () => {
    expect(shareLabel(1899, 15)).toBe('15%')
    expect(shareLabel(14, 0)).toBe('<1%')
    expect(shareLabel(0, 0)).toBe('0%')
    expect(shareLabel(3, 1)).toBe('1%')
  })
})

describe('engine rules in the inspector', () => {
  const engine = () => {
    const m = createMenace(defaultConfig('engine'))
    for (const key of ['         ', 'X        ', 'XO       ']) chooseMove(m, keyCells(key), seeded(1))
    return m
  }

  it('shows only boxes that exist, on their fixed slots, with the engine start beads', () => {
    const m = engine()
    expect(boxView(m, 0)?.number).toBe(1)
    expect(boxView(m, 0)?.started).toBe(36)
    expect(boxView(m, 5)).toBeNull()
    expect(boxView(m, 330)).toBeNull()
  })

  it('a move-5 box is a high slot and opens normally', () => {
    const m = createMenace(defaultConfig('engine'))
    const key = ALL_KEYS[330]
    setBeads(m, key, [...key].map((c) => (c === ' ' ? 4 : 0)))
    const v = boxView(m, 330)!
    expect(v.number).toBe(331)
    expect(v.move).toBe(5)
    expect(v.squares).toHaveLength(1)
    expect(v.started).toBe(4)
  })

  it('stepSlot skips slots without a box and stays put when none is left', () => {
    const has = (s: number) => [2, 7, 40, 330].includes(s)
    expect(stepSlot(2, 'ArrowRight', 338, 18, has)).toBe(7)
    expect(stepSlot(7, 'ArrowLeft', 338, 18, has)).toBe(2)
    expect(stepSlot(7, 'ArrowDown', 338, 18, has)).toBe(7)
    expect(stepSlot(2, 'ArrowDown', 338, 18, has)).toBe(2)
    expect(stepSlot(22, 'ArrowDown', 338, 18, (s) => s === 40 || s === 22)).toBe(40)
    expect(stepSlot(7, 'Home', 338, 18, has)).toBe(2)
    expect(stepSlot(7, 'End', 338, 18, has)).toBe(330)
    expect(stepSlot(7, 'Home', 338, 18, () => false)).toBe(7)
  })
})
