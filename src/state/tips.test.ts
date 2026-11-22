import { describe, expect, it } from 'vitest'
import { seeded } from '../engine/rng'
import { createGame } from './store'
import { bindTips, createTips, TIPS_KEY } from './tips'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

function setup(storage = fakeStorage()) {
  const g = createGame({ rng: seeded(2), lineRng: seeded(3) })
  const tips = createTips(storage)
  const unbind = bindTips(tips, g)
  return { g, tips, storage, unbind }
}

function playGame(g: ReturnType<typeof createGame>) {
  g.getState().start()
  let guard = 0
  while (g.getState().phase !== 'ledger' && guard++ < 20) {
    const s = g.getState()
    if (s.phase === 'menace') {
      s.think()
      g.getState().land()
      g.getState().boxHome()
    } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
  }
  g.getState().skipLedger()
}

describe('tips', () => {
  it('start on for a first-time visitor and off once the first game ends', () => {
    const { g, tips, storage } = setup()
    expect(tips.getState().on).toBe(true)
    g.getState().start()
    expect(tips.getState().on).toBe(true)
    playGame(g)
    expect(tips.getState().on).toBe(false)
    expect(storage.data.get(TIPS_KEY)).toBe('seen')
  })

  it('do not return after a reload once seen', () => {
    expect(createTips(fakeStorage({ [TIPS_KEY]: 'seen' })).getState().on).toBe(false)
  })

  it('"Show tips again" brings them back and forgets the seen mark', () => {
    const { g, tips, storage } = setup()
    playGame(g)
    expect(tips.getState().on).toBe(false)
    tips.getState().showAgain()
    expect(tips.getState().on).toBe(true)
    expect(storage.data.has(TIPS_KEY)).toBe(false)
    g.getState().start()
    expect(tips.getState().boxDone).toBe(false)
    expect(tips.getState().turnDone).toBe(false)
  })

  it('spend the box tip when the box is home and the turn tip when the player moves', () => {
    const { g, tips } = setup()
    g.getState().start()
    g.getState().think()
    expect(g.getState().boxOut).toBe(true)
    expect(tips.getState().boxDone).toBe(false)
    g.getState().land()
    expect(g.getState().phase).toBe('player')
    g.getState().boxHome()
    expect(tips.getState().boxDone).toBe(true)
    expect(tips.getState().turnDone).toBe(false)
    g.getState().play(g.getState().board.findIndex((c) => c === null))
    expect(tips.getState().turnDone).toBe(true)
  })

  it('survive storage that throws', () => {
    const angry = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    }
    const tips = createTips(angry)
    expect(tips.getState().on).toBe(true)
    expect(() => tips.getState().gameEnded()).not.toThrow()
    expect(tips.getState().on).toBe(false)
    expect(() => tips.getState().showAgain()).not.toThrow()
    expect(tips.getState().on).toBe(true)
  })

  it('survive no storage at all', () => {
    const tips = createTips(null)
    expect(tips.getState().on).toBe(true)
    tips.getState().gameEnded()
    expect(tips.getState().on).toBe(false)
  })
})

describe('greetings', () => {
  it('say the first-game line, then the returning line after a reload, then a normal opening', () => {
    const fresh = createGame({ rng: seeded(1), lineRng: seeded(1) })
    fresh.getState().start()
    expect(fresh.getState().greeted).toBe(true)
    const first = fresh.getState().speech
    expect(first.length).toBeGreaterThan(0)
    playGame(fresh)
    fresh.getState().start()
    expect(fresh.getState().greeted).toBe(false)
  })

  it('welcome a saved visitor back with the game count', () => {
    const a = createGame({ rng: seeded(1), lineRng: seeded(1) })
    playGame(a)
    playGame(a)
    const saved = { brain: a.getState().brain, record: a.getState().record, dish: a.getState().dish, speed: a.getState().speed, curve: a.getState().curve, trained: 0 }
    const b = createGame({ rng: seeded(1), lineRng: seeded(1), saved })
    b.getState().start()
    expect(b.getState().greeted).toBe(true)
    expect(b.getState().speech).toMatch(/\b2 games\b/)
  })
})
