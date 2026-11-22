import { describe, expect, it } from 'vitest'
import { createMenace, defaultConfig, deserialize, serialize, type MenaceConfig, type Menace } from '../engine/menace'
import { seeded } from '../engine/rng'
import { setBeads } from '../engine/testing'
import { randomOpponent } from '../engine/opponents'
import { playGame } from '../engine/trainer'
import { ALL_KEYS } from '../engine/slots'
import { LIMITS, configProblem, minStartBeads, isAllowedConfig, isDefaultConfig, sameConfig, sameShape, withBeads, withReward } from './config'
import { ABSURD_BEADS, MAX_BEADS, assertSupportedBrain, exportBrain, parseBrainFile, parseSave, writeSave, type StorageLike } from './persist'
import { emptyCurve } from './curve'
import { emptyDish } from './dish'

const cfg = (rules: 'engine' | '1961', startBeads: number[], win: number, draw: number, loss: number): MenaceConfig =>
  ({ rules, startBeads: startBeads as unknown as MenaceConfig['startBeads'], rewards: { win, draw, loss } })

describe('allowed configs', () => {
  it('accept the defaults of both rule sets', () => {
    expect(isAllowedConfig(defaultConfig('1961'))).toBe(true)
    expect(isAllowedConfig(defaultConfig('engine'))).toBe(true)
  })

  it('accept every edge of every range, for both rule sets', () => {
    for (const rules of ['1961', 'engine'] as const) {
      const lo = rules === '1961' ? 0 : 1
      expect(isAllowedConfig(cfg(rules, [lo, lo, lo, lo], 0, 0, 0))).toBe(true)
      expect(isAllowedConfig(cfg(rules, [20, 20, 20, 20], 10, 10, -10))).toBe(true)
      expect(isAllowedConfig(cfg(rules, rules === '1961' ? [0, 7, 20, 1] : [7, 7, 7, 7], 5, 0, -3))).toBe(true)
    }
  })

  it('reject values one step outside each range', () => {
    expect(isAllowedConfig(cfg('1961', [21, 3, 2, 1], 3, 1, -1))).toBe(false)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, -1], 3, 1, -1))).toBe(false)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 11, 1, -1))).toBe(false)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], -1, 1, -1))).toBe(false)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 3, 11, -1))).toBe(false)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 3, -1, -1))).toBe(false)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 3, 1, -11))).toBe(false)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 3, 1, 1))).toBe(false)
  })

  it('reject NaN, Infinity, fractions, huge and non-number values', () => {
    for (const bad of [NaN, Infinity, -Infinity, 1.5, 1e300, -1e300, 2 ** 53, '3' as unknown as number, null as unknown as number, undefined as unknown as number]) {
      expect(isAllowedConfig(cfg('1961', [4, 3, 2, bad], 3, 1, -1)), `beads ${String(bad)}`).toBe(false)
      expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], bad, 1, -1)), `win ${String(bad)}`).toBe(false)
      expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 3, bad, -1)), `draw ${String(bad)}`).toBe(false)
      expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 3, 1, bad)), `loss ${String(bad)}`).toBe(false)
    }
  })

  it('reject unknown rules, wrong shapes and junk, without throwing', () => {
    for (const bad of [null, undefined, 3, 'x', [], {}, { rules: 'chaos', startBeads: [4, 4, 4, 4], rewards: { win: 3, draw: 1, loss: -1 } },
      { rules: '1961', startBeads: [4, 3, 2], rewards: { win: 3, draw: 1, loss: -1 } },
      { rules: '1961', startBeads: [4, 3, 2, 1, 1], rewards: { win: 3, draw: 1, loss: -1 } },
      { rules: '1961', startBeads: [4, 3, 2, 1] }]) {
      expect(() => isAllowedConfig(bad)).not.toThrow()
      expect(isAllowedConfig(bad)).toBe(false)
    }
    expect(configProblem(cfg('1961', [4, 3, 2, 1], 3, 1, -11))).toMatch(/loss/)
  })

  it('exposes the ranges the panel uses', () => {
    expect(LIMITS.startBeads).toEqual({ min: 0, max: 20 })
    expect(LIMITS.win).toEqual({ min: 0, max: 10 })
    expect(LIMITS.loss).toEqual({ min: -10, max: 0 })
  })

  it('compares and edits configs without mutating them', () => {
    const base = defaultConfig('1961')
    expect(sameConfig(base, defaultConfig('1961'))).toBe(true)
    expect(isDefaultConfig(base)).toBe(true)
    const rewards = withReward(base, 'win', 5)
    expect(rewards.rewards.win).toBe(5)
    expect(base.rewards.win).toBe(3)
    expect(sameShape(base, rewards)).toBe(true)
    const beads = withBeads(base, 1, 9)
    expect(beads.startBeads).toEqual([4, 9, 2, 1])
    expect(base.startBeads).toEqual([4, 3, 2, 1])
    expect(sameShape(base, beads)).toBe(false)
    expect(sameShape(base, defaultConfig('engine'))).toBe(false)
  })
})

describe('engine rules start beads', () => {
  it('need at least 1 (the engine floors a box at 1, so 0 would let a loss add beads)', () => {
    expect(minStartBeads('engine')).toBe(1)
    expect(minStartBeads('1961')).toBe(0)
    expect(isAllowedConfig(cfg('engine', [0, 0, 0, 0], 3, 1, -1))).toBe(false)
    expect(isAllowedConfig(cfg('engine', [1, 1, 1, 1], 3, 1, -1))).toBe(true)
    expect(isAllowedConfig(cfg('1961', [0, 0, 0, 0], 3, 1, -1))).toBe(true)
  })

  it('need all four equal, because the engine reads only one number', () => {
    expect(isAllowedConfig(cfg('engine', [4, 4, 4, 3], 3, 1, -1))).toBe(false)
    expect(configProblem(cfg('engine', [4, 3, 2, 1], 3, 1, -1))).toMatch(/equal/)
    expect(isAllowedConfig(cfg('1961', [4, 3, 2, 1], 3, 1, -1))).toBe(true)
  })

  it('an imported engine brain with mixed or zero start beads is rejected', () => {
    for (const startBeads of [[4, 4, 4, 5], [0, 0, 0, 0]]) {
      const file = JSON.parse(exportBrain(createMenace(defaultConfig('engine')), { menace: 0, draws: 0, you: 0 }))
      file.brain.config.startBeads = startBeads
      expect(() => parseBrainFile(JSON.stringify(file))).toThrow(/brain/i)
    }
  })
})

describe('brains from outside use the same ranges', () => {
  const plain = { menace: 0, draws: 0, you: 0 }
  const saved = (brain: Menace) => ({ brain, record: plain, dish: emptyDish(), speed: 1 as const, curve: emptyCurve(), trained: 0 })
  const text = (brain: Menace) => {
    let out = ''
    const storage: StorageLike = { getItem: () => null, setItem: (_k, v) => (out = v), removeItem: () => undefined }
    writeSave(saved(brain), storage)
    return out
  }

  it('an in-range config round-trips through a save and an export, for both rule sets', () => {
    for (const config of [cfg('1961', [5, 2, 0, 20], 7, 0, -4), cfg('engine', [9, 9, 9, 9], 10, 10, -10), cfg('engine', [1, 1, 1, 1], 0, 0, 0)]) {
      const brain = createMenace(config)
      expect(parseSave(text(brain)).brain.config).toEqual(config)
      expect(parseBrainFile(exportBrain(brain, plain)).config).toEqual(config)
    }
  })

  it('the ticket 03 hostile files are still rejected', () => {
    for (const mutate of [
      (c: MenaceConfig & { rewards: { loss: number } }) => (c.rewards.loss = -1e300),
      (c: MenaceConfig & { rewards: { win: number } }) => (c.rewards.win = 1e300),
    ]) {
      const file = JSON.parse(exportBrain(createMenace(), plain)) as { brain: { config: never } }
      mutate(file.brain.config)
      expect(() => parseBrainFile(JSON.stringify(file))).toThrow(/brain/i)
    }
    const hostile = JSON.parse(exportBrain(createMenace(), plain)) as { brain: { boxes: Record<string, number[]> } }
    hostile.brain.boxes[Object.keys(hostile.brain.boxes)[0]][0] = 1e300
    expect(() => parseBrainFile(JSON.stringify(hostile))).toThrow(/brain/i)
    const cap = createMenace()
    setBeads(cap, ALL_KEYS[0], [ABSURD_BEADS + 1, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(() => assertSupportedBrain(cap)).toThrow(/beads/)
  })

  it('a hand-built hostile brain object is rejected before any play', () => {
    const brain = deserialize(serialize(createMenace(defaultConfig('engine'))))
    const hostile = { config: cfg('engine', [4, 4, 4, 4], 3, 1, -1e300), boxes: brain.boxes }
    expect(() => assertSupportedBrain(hostile)).toThrow(/out of range/)
  })
})

describe('extreme rewards play and learn without errors', () => {
  for (const rules of ['1961', 'engine'] as const) {
    for (const [label, config] of [
      ['+10 / +10 / -10', cfg(rules, rules === '1961' ? [20, 20, 20, 20] : [20, 20, 20, 20], 10, 10, -10)],
      ['0 / 0 / 0', cfg(rules, [1, 1, 1, 1], 0, 0, 0)],
      ['+10 / 0 / -10, start 1', cfg(rules, [1, 1, 1, 1], 10, 0, -10)],
    ] as const) {
      it(`${rules} rules, ${label}: 1,000 seeded games, then a save round-trip`, () => {
        const brain = createMenace(config)
        const rng = seeded(42)
        const results = { X: 0, O: 0, D: 0 }
        for (let i = 0; i < 1000; i++) results[playGame(brain, randomOpponent, rng).result]++
        expect(results.X + results.O + results.D).toBe(1000)
        for (const beads of brain.boxes.values()) {
          for (const b of beads) {
            expect(Number.isSafeInteger(b)).toBe(true)
            expect(b).toBeGreaterThanOrEqual(0)
            expect(b).toBeLessThanOrEqual(MAX_BEADS)
          }
        }
        // What 1,000 games made is still a brain the loader accepts.
        const again = deserialize(serialize(brain))
        expect(() => assertSupportedBrain(again)).not.toThrow()
      })
    }
  }
})
