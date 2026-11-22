import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { boxKeys, createMenace, defaultConfig, serialize, type Menace } from '../engine/menace'
import { seeded } from '../engine/rng'
import { setBeads } from '../engine/testing'
import {
  ABSURD_BEADS,
  MAX_BEADS,
  MAX_FILE_BYTES,
  SAVE_KEY,
  attachPersistence,
  clearSave,
  exportBrain,
  loadSave,
  parseBrainFile,
  parseSave,
  writeSave,
  type Saved,
  type StorageLike,
} from './persist'
import { createGame, type GameState } from './store'
import { savedFrom } from './persist'
import { emptyCurve } from './curve'
import { MAX_DISH_COUNT, dishTotal, emptyDish } from './dish'
import type { StoreApi } from 'zustand/vanilla'

class FakeStorage implements StorageLike {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

/** A brain that differs from a fresh one, so equality checks mean something. */
function edited(): Menace {
  const m = createMenace()
  const key = boxKeys(m)[5]
  setBeads(m, key, m.boxes.get(key)!.map((b) => (b > 0 ? b + 7 : 0)))
  return m
}

function sample(): Saved {
  return { brain: edited(), record: { menace: 3, draws: 2, you: 5 }, dish: { counts: [1, 0, 0, 0, 2, 0, 0, 0, 1], tail: [0, 4, 4, 8] }, speed: 2, curve: emptyCurve(), trained: 0 }
}

function tamper(mutate: (data: Record<string, unknown>) => void): string {
  const storage = new FakeStorage()
  writeSave(sample(), storage)
  const data = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>
  mutate(data)
  return JSON.stringify(data)
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

/** Plays one full game (O takes the first empty square) and closes the ledger. */
function playOneGame(g: StoreApi<GameState>, skip = true) {
  g.getState().start()
  let guard = 0
  while (g.getState().phase !== 'ledger' && guard++ < 20) {
    const s = g.getState()
    if (s.phase === 'menace') {
      s.think()
      g.getState().land()
    } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
  }
  if (skip) g.getState().skipLedger()
}

describe('save and load', () => {
  it('round-trips the brain, record, dish and speed', () => {
    const storage = new FakeStorage()
    const saved = sample()
    expect(writeSave(saved, storage)).toBe(true)
    const back = loadSave(storage)
    expect(back).not.toBeNull()
    expect(serialize(back!.brain)).toBe(serialize(saved.brain))
    expect(back!.record).toEqual(saved.record)
    expect(back!.dish).toEqual(saved.dish)
    expect(back!.speed).toBe(2)
  })

  it('returns null when there is no save', () => {
    expect(loadSave(new FakeStorage())).toBeNull()
    expect(loadSave(null)).toBeNull()
  })

  it('discards corrupt JSON without throwing, and clears it', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, '{not json')
    expect(loadSave(storage)).toBeNull()
    expect(storage.getItem(SAVE_KEY)).toBeNull()
    expect(console.warn).toHaveBeenCalled()
  })

  it('discards a wrong version', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, tamper((d) => (d.version = 2)))
    expect(loadSave(storage)).toBeNull()
    expect(console.warn).toHaveBeenCalled()
  })

  it('discards a tampered brain', () => {
    const cases: ((d: Record<string, unknown>) => void)[] = [
      (d) => {
        const b = JSON.parse(d.brain as string) as { boxes: Record<string, number[]> }
        delete b.boxes[Object.keys(b.boxes)[0]]
        d.brain = JSON.stringify(b)
      },
      (d) => {
        const b = JSON.parse(d.brain as string) as { boxes: Record<string, number[]> }
        b.boxes[Object.keys(b.boxes)[0]][0] = -4
        d.brain = JSON.stringify(b)
      },
      (d) => (d.brain = 'null'),
      (d) => (d.brain = 12),
    ]
    for (const c of cases) {
      const storage = new FakeStorage()
      storage.setItem(SAVE_KEY, tamper(c))
      expect(loadSave(storage)).toBeNull()
    }
  })

  it('discards a bad record, dish or speed', () => {
    const cases: ((d: Record<string, unknown>) => void)[] = [
      (d) => (d.record = { menace: -1, draws: 0, you: 0 }),
      (d) => (d.record = { menace: 1.5, draws: 0, you: 0 }),
      (d) => (d.record = null),
      (d) => (d.speed = 3),
    ]
    for (const c of cases) expect(() => parseSave(tamper(c))).toThrow()
  })

  it('a bad dish costs only the dish, never the brain', () => {
    for (const bad of [[0, 9], 'beads', null, { counts: 'x' }]) {
      const back = parseSave(tamper((d) => ((d.dish = bad), delete d.confiscated)))
      expect(serialize(back.brain)).toBe(serialize(sample().brain))
      expect(back.record).toEqual(sample().record)
    }
  })

  it('migrates a save from the old format (confiscated list) and keeps the brain', () => {
    const text = tamper((d) => {
      delete d.dish
      d.confiscated = Array.from({ length: 300_000 }, (_, i) => i % 9)
    })
    const back = parseSave(text)
    expect(dishTotal(back.dish)).toBe(300_000)
    expect(back.dish.tail).toHaveLength(48)
    expect(serialize(back.brain)).toBe(serialize(sample().brain))
  })

  it('a dish with a huge count loads, clamped', () => {
    const back = parseSave(tamper((d) => (d.dish = { counts: [1e300, 0, 0, 0, 0, 0, 0, 0, 0], tail: [] })))
    expect(back.dish.counts[0]).toBeLessThanOrEqual(MAX_DISH_COUNT)
  })

  it('survives a storage that throws on every call', () => {
    expect(loadSave(throwing)).toBeNull()
    expect(writeSave(sample(), throwing)).toBe(false)
    const g = createGame({ rng: seeded(1), lineRng: seeded(2) })
    const off = attachPersistence(g, throwing)
    expect(() => playOneGame(g)).not.toThrow()
    expect(g.getState().phase).toBe('over')
    expect(g.getState().record.menace + g.getState().record.draws + g.getState().record.you).toBe(1)
    off()
  })
})

describe('when it saves', () => {
  /** Walks a game to the moment the ledger opens. */
  function toLedger(g: StoreApi<GameState>, onO?: () => void) {
    g.getState().start()
    let guard = 0
    while (g.getState().phase !== 'ledger' && guard++ < 20) {
      const s = g.getState()
      if (s.phase === 'menace') {
        s.think()
        g.getState().land()
      } else if (s.phase === 'player') {
        onO?.()
        s.play(s.board.findIndex((c) => c === null))
      }
    }
    expect(g.getState().phase).toBe('ledger')
  }

  it('saves when the ledger opens, never while the game is still being played', () => {
    const storage = new FakeStorage()
    const g = createGame({ rng: seeded(3), lineRng: seeded(4) })
    attachPersistence(g, storage)
    toLedger(g, () => expect(storage.getItem(SAVE_KEY)).toBeNull())
    const opened = loadSave(storage)!
    expect(opened.record).toEqual(g.getState().record)
    expect(serialize(opened.brain)).toBe(serialize(g.getState().brain))
    expect(opened.dish).toEqual(g.getState().dish)
    // Closing the ledger, by skip or by watching, leaves the same save.
    g.getState().skipLedger()
    expect(loadSave(storage)!.record).toEqual(opened.record)

    playOneGame(g, false)
    for (let at = g.getState().ledgerAt; g.getState().phase === 'ledger'; at = g.getState().ledgerAt) g.getState().ledgerNext(at)
    const second = loadSave(storage)!
    expect(second.record.menace + second.record.draws + second.record.you).toBe(2)
  })

  it('reloading during the ledger keeps the game that was just played', () => {
    const storage = new FakeStorage()
    const g = createGame({ rng: seeded(8), lineRng: seeded(9) })
    attachPersistence(g, storage)
    const fresh = serialize(createMenace())
    toLedger(g)
    // The brain has learned and the record counts the game; the ledger is only the replay.
    expect(serialize(g.getState().brain)).not.toBe(fresh)
    const reloaded = createGame({ saved: loadSave(storage) ?? undefined })
    expect(serialize(reloaded.getState().brain)).toBe(serialize(g.getState().brain))
    expect(reloaded.getState().record).toEqual(g.getState().record)
    expect(dishTotal(reloaded.getState().dish)).toBe(dishTotal(g.getState().dish))
    expect(reloaded.getState().phase).toBe('title')
  })

  it('a reload restores the brain, record, dish and speed', () => {
    const storage = new FakeStorage()
    const g = createGame({ rng: seeded(5), lineRng: seeded(6) })
    attachPersistence(g, storage)
    g.getState().setSpeed(4)
    for (let i = 0; i < 3; i++) playOneGame(g)
    const reloaded = createGame({ saved: loadSave(storage) ?? undefined })
    expect(serialize(reloaded.getState().brain)).toBe(serialize(g.getState().brain))
    expect(reloaded.getState().record).toEqual(g.getState().record)
    expect(reloaded.getState().dish).toEqual(g.getState().dish)
    expect(reloaded.getState().speed).toBe(4)
    expect(reloaded.getState().phase).toBe('title')
  })
})

describe('a failed save is visible', () => {
  it('saveOk stays true while saves work', () => {
    const g = createGame({ rng: seeded(1), lineRng: seeded(2) })
    attachPersistence(g, new FakeStorage())
    expect(g.getState().saveOk).toBe(true)
    playOneGame(g)
    expect(g.getState().saveOk).toBe(true)
  })

  it('saveOk goes false when storage refuses, with one line in the speech slip', () => {
    const g = createGame({ rng: seeded(1), lineRng: seeded(2) })
    attachPersistence(g, throwing)
    g.getState().start()
    let guard = 0
    while (g.getState().phase !== 'ledger' && guard++ < 20) {
      const s = g.getState()
      if (s.phase === 'menace') {
        s.think()
        g.getState().land()
      } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
    }
    expect(g.getState().saveOk).toBe(false)
    expect(g.getState().speech).toMatch(/not saved|will not keep|storage/i)
    // One time only: the next failed save does not say it again.
    g.getState().skipLedger()
    const afterSkip = g.getState().speech
    g.getState().setSpeed(2)
    expect(g.getState().speech).toBe(afterSkip)
  })

  it('saveOk recovers when a later save works', () => {
    let broken = true
    const flaky: StorageLike = {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        if (broken) throw new Error('quota')
      },
    }
    const g = createGame({ saved: sample() })
    attachPersistence(g, flaky)
    g.getState().setSpeed(1)
    expect(g.getState().saveOk).toBe(false)
    broken = false
    g.getState().setSpeed(2)
    expect(g.getState().saveOk).toBe(true)
  })
})

describe('clearSave', () => {
  it('removes the save, and survives a storage that throws', () => {
    const storage = new FakeStorage()
    writeSave(sample(), storage)
    expect(clearSave(storage)).toBe(true)
    expect(storage.getItem(SAVE_KEY)).toBeNull()
    expect(clearSave(throwing)).toBe(false)
    expect(clearSave(null)).toBe(false)
  })
})

describe('a tampered brain can never crash the game', () => {
  const plain = { menace: 0, draws: 0, you: 0 }

  /** An export with the brain text edited by `mutate`. */
  function exportWith(mutate: (brain: { config: Record<string, unknown>; boxes: Record<string, number[]> }) => void): string {
    const file = JSON.parse(exportBrain(createMenace(), plain)) as { brain: { config: Record<string, unknown>; boxes: Record<string, number[]> } }
    mutate(file.brain)
    return JSON.stringify(file)
  }
  const firstKey = (b: { boxes: Record<string, number[]> }) => Object.keys(b.boxes)[0]

  const attacks: Record<string, (b: { config: Record<string, unknown>; boxes: Record<string, number[]> }) => void> = {
    'beads of 1e300': (b) => (b.boxes[firstKey(b)][0] = 1e300),
    'beads past absurd': (b) => (b.boxes[firstKey(b)][0] = ABSURD_BEADS + 1),
    'loss of -1e300': (b) => (b.config.rewards = { win: 3, draw: 1, loss: -1e300 }),
    'win of 1e300': (b) => (b.config.rewards = { win: 1e300, draw: 1, loss: -1 }),
    'a loss below the range': (b) => (b.config.rewards = { win: 3, draw: 1, loss: -11 }),
    'a win above the range': (b) => (b.config.rewards = { win: 11, draw: 1, loss: -1 }),
    'a positive loss': (b) => (b.config.rewards = { win: 3, draw: 1, loss: 1 }),
    'start beads above the range': (b) => (b.config.startBeads = [21, 3, 2, 1]),
    'negative start beads': (b) => (b.config.startBeads = [4, -1, 2, 1]),
    'NaN start beads': (b) => (b.config.startBeads = [4, null, 2, 1]),
    'unknown rules': (b) => (b.config.rules = 'chaos'),
    'engine rules with a box that is no position': (b) => {
      b.config.rules = 'engine'
      b.boxes = { XXXXXXXXX: [0, 0, 0, 0, 0, 0, 0, 0, 0] }
    },
    'engine rules with thousands of boxes': (b) => {
      b.config.rules = 'engine'
      b.boxes = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`${i.toString(3).padStart(9, '0').replace(/0/g, ' ').replace(/1/g, 'X').replace(/2/g, 'O')}`, [0, 0, 0, 0, 0, 0, 0, 0, 0]]))
    },
  }

  for (const [name, mutate] of Object.entries(attacks)) {
    it(`parseBrainFile rejects ${name}`, () => {
      expect(() => parseBrainFile(exportWith(mutate))).toThrow(/brain/i)
    })
    it(`parseSave rejects ${name}`, () => {
      const text = tamper((d) => {
        const b = JSON.parse(d.brain as string) as { config: Record<string, unknown>; boxes: Record<string, number[]> }
        mutate(b)
        d.brain = JSON.stringify(b)
      })
      expect(() => parseSave(text)).toThrow()
      const storage = new FakeStorage()
      storage.setItem(SAVE_KEY, text)
      expect(loadSave(storage)).toBeNull()
    })
  }

  it('an engine-rules brain with lazy boxes is accepted now (ticket 06)', () => {
    const lazy = JSON.stringify({ format: 'menace-brain', version: 1, brain: JSON.parse(serialize(createMenace(defaultConfig('engine')))) })
    expect(parseBrainFile(lazy).config.rules).toBe('engine')
  })

  it('beads at exactly the cap are accepted', () => {
    const ok = exportWith((b) => (b.boxes[firstKey(b)][0] = MAX_BEADS))
    expect(parseBrainFile(ok).boxes.size).toBe(304)
  })

  it('the game survives a loss in a box holding the cap of beads', () => {
    const g = createGame({ rng: seeded(2), lineRng: seeded(3) })
    g.getState().start()
    g.getState().think()
    const key = g.getState().turn!.boxKey!
    setBeads(g.getState().brain, key, g.getState().brain.boxes.get(key)!.map((b) => (b > 0 ? MAX_BEADS : 0)))
    g.getState().land()
    for (let i = 0; i < 20 && g.getState().phase !== 'ledger'; i++) {
      const s = g.getState()
      if (s.phase === 'menace') {
        s.think()
        g.getState().land()
      } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
    }
    expect(() => g.getState().skipLedger()).not.toThrow()
    expect(g.getState().phase).toBe('over')
  })

  it('exports the file size limit for the UI', () => {
    expect(MAX_FILE_BYTES).toBe(5_000_000)
  })
})

describe('reset', () => {
  it('gives 304 fresh boxes, a zero record and an empty dish, and saves', () => {
    const storage = new FakeStorage()
    const g = createGame({ saved: sample() })
    attachPersistence(g, storage)
    expect(g.getState().resetBrain()).toBe(true)
    const s = g.getState()
    expect(s.brain.boxes.size).toBe(304)
    expect(serialize(s.brain)).toBe(serialize(createMenace()))
    expect(s.record).toEqual({ menace: 0, draws: 0, you: 0 })
    expect(s.dish).toEqual(emptyDish())
    const saved = loadSave(storage)!
    expect(saved.record).toEqual({ menace: 0, draws: 0, you: 0 })
    expect(serialize(saved.brain)).toBe(serialize(createMenace()))
  })

  it('is refused mid-game', () => {
    const g = createGame({ saved: sample(), rng: seeded(1) })
    g.getState().start()
    expect(g.getState().resetBrain()).toBe(false)
    expect(g.getState().record.you).toBe(5)
  })
})

describe('export and import', () => {
  it('an export carries the envelope and the engine serialize output', () => {
    const m = edited()
    const file = JSON.parse(exportBrain(m, { menace: 1, draws: 2, you: 3 }, new Date('2026-11-20T10:00:00Z'))) as Record<string, unknown>
    expect(file.format).toBe('menace-brain')
    expect(file.version).toBe(1)
    expect(file.exportedAt).toBe('2026-11-20T10:00:00.000Z')
    expect(file.gamesPlayed).toBe(6)
    expect(JSON.stringify(file.brain)).toBe(serialize(m))
  })

  it('importing a valid export restores the identical brain and keeps the record', () => {
    const storage = new FakeStorage()
    const original = edited()
    const text = exportBrain(original, { menace: 0, draws: 0, you: 0 })
    const g = createGame({ saved: sample() })
    attachPersistence(g, storage)
    const record = g.getState().record
    expect(g.getState().importBrain(parseBrainFile(text))).toBe(true)
    expect(serialize(g.getState().brain)).toBe(serialize(original))
    expect(g.getState().record).toBe(record)
    expect(g.getState().speech).toMatch(/restored/)
    expect(serialize(loadSave(storage)!.brain)).toBe(serialize(original))
  })

  it('importing garbage throws a clear message and leaves the brain untouched', () => {
    const g = createGame({ saved: sample() })
    const before = serialize(g.getState().brain)
    const bad = [
      'not json at all',
      '[]',
      '{}',
      JSON.stringify({ format: 'something-else', version: 1, brain: {} }),
      JSON.stringify({ format: 'menace-brain', version: 9, brain: {} }),
      JSON.stringify({ format: 'menace-brain', version: 1 }),
      JSON.stringify({ format: 'menace-brain', version: 1, brain: { version: 1, config: {}, boxes: {} } }),
      exportBrain(edited(), { menace: 0, draws: 0, you: 0 }).replace('"1961"', '"engine"').replace(/"boxes": \{/, '"boxes": {"XXXXXXXXX": [1,1,1,1,1,1,1,1,1],'),
    ]
    for (const text of bad) {
      expect(() => parseBrainFile(text)).toThrow(Error)
      try {
        parseBrainFile(text)
      } catch (err) {
        expect((err as Error).message.length).toBeGreaterThan(10)
      }
    }
    expect(serialize(g.getState().brain)).toBe(before)
  })

  it('import is refused mid-game', () => {
    const g = createGame({ rng: seeded(1) })
    g.getState().start()
    const before = serialize(g.getState().brain)
    expect(g.getState().importBrain(createMenace())).toBe(false)
    expect(serialize(g.getState().brain)).toBe(before)
  })
})

describe('Tinker settings persist', () => {
  it('a new rule set and new rewards survive a reload and an export/import', () => {
    const storage = new FakeStorage()
    const g = createGame({ rng: seeded(6), lineRng: seeded(7) })
    attachPersistence(g, storage)
    const config = { rules: 'engine' as const, startBeads: [6, 6, 6, 6] as [number, number, number, number], rewards: { win: 7, draw: 2, loss: -4 } }
    expect(g.getState().applyConfig(config)).toBe(true)
    g.getState().start()
    for (let i = 0; i < 30 && g.getState().phase !== 'ledger'; i++) {
      const s = g.getState()
      if (s.phase === 'menace') {
        s.think()
        g.getState().land()
      } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
    }
    g.getState().skipLedger()
    const reloaded = createGame({ saved: loadSave(storage)! })
    expect(reloaded.getState().brain.config).toEqual(config)
    expect(reloaded.getState().brain.boxes.size).toBe(g.getState().brain.boxes.size)
    // Export, wipe back to 1961, import: the engine brain returns with the same settings.
    const file = exportBrain(g.getState().brain, g.getState().record)
    expect(g.getState().applyConfig(defaultConfig('1961'))).toBe(true)
    expect(g.getState().importBrain(parseBrainFile(file))).toBe(true)
    expect(g.getState().brain.config).toEqual(config)
    expect(serialize(g.getState().brain)).toBe(serialize(reloaded.getState().brain))
  })

  it('a rewards-only change is saved too', () => {
    const storage = new FakeStorage()
    const g = createGame()
    attachPersistence(g, storage)
    expect(g.getState().applyConfig({ ...defaultConfig('1961'), rewards: { win: 9, draw: 0, loss: -9 } })).toBe(true)
    expect(loadSave(storage)!.brain.config.rewards).toEqual({ win: 9, draw: 0, loss: -9 })
  })
})

describe('bead counts above the cap', () => {
  const plain = { menace: 0, draws: 0, you: 0 }

  it('a count above MAX_BEADS loads clamped instead of discarding the save', () => {
    const brain = createMenace()
    const key = boxKeys(brain)[0]
    setBeads(brain, key, [MAX_BEADS + 100, 4, 4, 4, 4, 4, 4, 4, 4])
    const storage = new FakeStorage()
    writeSave({ brain, record: { menace: 3, draws: 1, you: 2 }, dish: emptyDish(), speed: 1, curve: emptyCurve(), trained: 7 }, storage)
    const loaded = loadSave(storage)
    expect(loaded).not.toBeNull()
    expect(loaded!.brain.boxes.get(key)![0]).toBe(MAX_BEADS)
    expect(loaded!.record).toEqual({ menace: 3, draws: 1, you: 2 })
    expect(storage.getItem(SAVE_KEY)).not.toBeNull()
  })

  it('an imported file with a count above MAX_BEADS loads clamped', () => {
    const brain = createMenace()
    const key = boxKeys(brain)[0]
    setBeads(brain, key, [MAX_BEADS + 100, 4, 4, 4, 4, 4, 4, 4, 4])
    expect(parseBrainFile(exportBrain(brain, plain)).boxes.get(key)![0]).toBe(MAX_BEADS)
  })

  it('absurd, 1e300 and the old hostile rewards are still rejected', () => {
    for (const v of [ABSURD_BEADS + 1, 1e300]) {
      const brain = createMenace()
      setBeads(brain, boxKeys(brain)[0], [v, 4, 4, 4, 4, 4, 4, 4, 4])
      expect(() => parseBrainFile(exportBrain(brain, plain))).toThrow(/brain/i)
    }
  })

  it('a box at MAX_BEADS - 5 plus a win stays at MAX_BEADS and survives save and load', () => {
    const brain = createMenace({ rules: '1961', startBeads: [4, 3, 2, 1], rewards: { win: 10, draw: 10, loss: 0 } })
    for (const key of boxKeys(brain)) setBeads(brain, key, [...key].map((c) => (c === ' ' ? MAX_BEADS - 5 : 0)))
    const g = createGame({ brain, rng: seeded(3), lineRng: seeded(4) })
    const storage = new FakeStorage()
    attachPersistence(g, storage)
    g.getState().start()
    for (let i = 0; i < 40 && g.getState().phase !== 'ledger'; i++) {
      const s = g.getState()
      if (s.phase === 'menace') {
        s.think()
        g.getState().land()
      } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
    }
    expect(g.getState().phase).toBe('ledger')
    const used = g.getState().history.map((h) => g.getState().brain.boxes.get(h.boxKey)![h.canonMove])
    expect(used.length).toBeGreaterThan(0)
    for (const v of used) expect(v).toBe(MAX_BEADS)
    for (const beads of g.getState().brain.boxes.values()) for (const b of beads) expect(b).toBeLessThanOrEqual(MAX_BEADS)
    expect(loadSave(storage)).not.toBeNull()
  })

  it('training clamps too', () => {
    const brain = createMenace({ rules: '1961', startBeads: [4, 3, 2, 1], rewards: { win: 10, draw: 10, loss: 0 } })
    for (const key of boxKeys(brain)) setBeads(brain, key, [...key].map((c) => (c === ' ' ? MAX_BEADS - 5 : 0)))
    const g = createGame({ brain, rng: seeded(9), lineRng: seeded(1) })
    g.getState().startTraining('random', 200)
    while (g.getState().training !== null) g.getState().trainStep(1000, 50)
    for (const beads of g.getState().brain.boxes.values()) for (const b of beads) expect(b).toBeLessThanOrEqual(MAX_BEADS)
    const storage = new FakeStorage()
    expect(writeSave(savedFrom(g.getState()), storage)).toBe(true)
    expect(loadSave(storage)).not.toBeNull()
  })
})
