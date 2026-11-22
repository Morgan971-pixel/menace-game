import { describe, expect, it } from 'vitest'
import { chooseMove, createMenace, defaultConfig } from '../engine/menace'
import { seeded } from '../engine/rng'
import { inspector } from './inspector'
import { isInspecting } from './inspecting'
import { createGame } from './store'

describe('the inspector follows the brain', () => {
  const engine = defaultConfig('engine')

  it('isInspecting is true only when the open slot holds a box', () => {
    const m = createMenace(engine)
    expect(isInspecting(m, null)).toBe(false)
    expect(isInspecting(m, 0)).toBe(false)
    chooseMove(m, Array(9).fill(null), seeded(1))
    expect(isInspecting(m, 0)).toBe(true)
    expect(isInspecting(m, 1)).toBe(false)
    expect(isInspecting(createMenace(), 303)).toBe(true)
    expect(isInspecting(createMenace(), 304)).toBe(false)
  })

  it('a Tinker wipe closes the open inspector', () => {
    const g = createGame({ rng: seeded(1) })
    inspector.getState().open(0)
    expect(g.getState().applyConfig(engine)).toBe(true)
    expect(inspector.getState().slot).toBeNull()
  })

  it('a rewards-only change keeps it open (the boxes are the same)', () => {
    const g = createGame({ rng: seeded(1) })
    inspector.getState().open(0)
    expect(g.getState().applyConfig({ ...defaultConfig('1961'), rewards: { win: 5, draw: 1, loss: -1 } })).toBe(true)
    expect(inspector.getState().slot).toBe(0)
    inspector.getState().close()
  })

  it('Reset and import close it', () => {
    const g = createGame({ rng: seeded(1), brain: createMenace(engine) })
    chooseMove(g.getState().brain, Array(9).fill(null), seeded(1))
    inspector.getState().open(0)
    expect(g.getState().resetBrain()).toBe(true)
    expect(inspector.getState().slot).toBeNull()
    inspector.getState().open(0)
    expect(g.getState().importBrain(createMenace(engine))).toBe(true)
    expect(inspector.getState().slot).toBeNull()
  })
})
