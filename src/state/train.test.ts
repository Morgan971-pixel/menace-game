import { describe, expect, it } from 'vitest'
import type { StoreApi } from 'zustand/vanilla'
import { boxIndex, createMenace, serialize } from '../engine/menace'
import { randomOpponent } from '../engine/opponents'
import { seeded } from '../engine/rng'
import { playGame, train } from '../engine/trainer'
import { curveTotal } from './curve'
import { attachFlushOnLeave, attachPersistence, loadSave, SAVE_KEY, type StorageLike } from './persist'
import { createGame, SHIMMER_GAMES, type GameState } from './store'

class FakeStorage implements StorageLike {
  data = new Map<string, string>()
  writes = 0
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.writes++
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const newGame = (seed = 5) => createGame({ rng: seeded(seed), lineRng: seeded(seed + 1000) })

/** Steps until the run ends. A budget of Infinity and a cap of 25 games per step mimic frames without a clock. */
function runToEnd(g: StoreApi<GameState>, perStep = 25): number {
  let steps = 0
  while (g.getState().training !== null && steps < 10_000) {
    g.getState().trainStep(Infinity, perStep)
    steps++
  }
  return steps
}

function playOneGame(g: StoreApi<GameState>) {
  g.getState().start()
  let guard = 0
  while (g.getState().phase !== 'ledger' && guard++ < 20) {
    const s = g.getState()
    if (s.phase === 'menace') {
      s.think()
      g.getState().land()
    } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
  }
  g.getState().skipLedger()
}

describe('training in the store', () => {
  it('starts only on the title screen or game over, never mid-game', () => {
    const g = newGame()
    g.getState().start()
    expect(g.getState().phase).toBe('menace')
    expect(g.getState().startTraining('random', 100)).toBe(false)
    expect(g.getState().training).toBeNull()
    g.getState().think()
    g.getState().land()
    expect(g.getState().phase).toBe('player')
    expect(g.getState().startTraining('random', 100)).toBe(false)
  })

  it('refuses while the ledger is open, and accepts once the game is over', () => {
    const g = newGame()
    g.getState().start()
    let guard = 0
    while (g.getState().phase !== 'ledger' && guard++ < 20) {
      const s = g.getState()
      if (s.phase === 'menace') {
        s.think()
        g.getState().land()
      } else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
    }
    expect(g.getState().phase).toBe('ledger')
    expect(g.getState().startTraining('random', 10)).toBe(false)
    g.getState().skipLedger()
    expect(g.getState().startTraining('random', 10)).toBe(true)
  })

  it('rejects odd arguments', () => {
    const g = newGame()
    expect(g.getState().startTraining('nobody' as never, 10)).toBe(false)
    expect(g.getState().startTraining('random', 0)).toBe(false)
    expect(g.getState().startTraining('random', 2.5)).toBe(false)
    expect(g.getState().startTraining('random', 1e9)).toBe(false)
  })

  it('locks Play, reset, import and a second run while it runs', () => {
    const g = newGame()
    expect(g.getState().startTraining('random', 100)).toBe(true)
    g.getState().start()
    expect(g.getState().phase).toBe('title')
    expect(g.getState().resetBrain()).toBe(false)
    expect(g.getState().importBrain(createMenace())).toBe(false)
    expect(g.getState().startTraining('perfect', 10)).toBe(false)
    g.getState().stopTraining()
  })

  it('plays every game, grows the curve and the training total, and leaves the player record alone', () => {
    const g = newGame()
    const record = g.getState().record
    const games = g.getState().games
    g.getState().startTraining('random', 130)
    const steps = runToEnd(g, 25)
    expect(steps).toBe(6)
    const s = g.getState()
    expect(s.training).toBeNull()
    expect(s.trained).toBe(130)
    expect(curveTotal(s.curve)).toBe(130)
    expect(s.record).toBe(record)
    expect(s.games).toBe(games)
    expect(s.speech).toMatch(/^130 games against Random\./)
    expect(s.phase).toBe('title')
  })

  it('matches the headless trainer game for game, so the brain is the real learner', () => {
    const g = newGame(9)
    g.getState().startTraining('random', 200)
    runToEnd(g, 20)
    const reference = createMenace()
    train(reference, 200, randomOpponent, seeded(9))
    expect(serialize(g.getState().brain)).toBe(serialize(reference))
  })

  it('Stop leaves a consistent brain and curve: exactly the games played so far', () => {
    const g = newGame(9)
    g.getState().startTraining('random', 1000)
    g.getState().trainStep(Infinity, 20)
    g.getState().trainStep(Infinity, 20)
    expect(g.getState().training?.done).toBe(40)
    g.getState().stopTraining()
    const s = g.getState()
    expect(s.training).toBeNull()
    expect(s.trained).toBe(40)
    expect(curveTotal(s.curve)).toBe(40)
    expect(s.speech).toMatch(/^Stopped after 40 of 1,000 games against Random\./)
    const reference = createMenace()
    train(reference, 40, randomOpponent, seeded(9))
    expect(serialize(s.brain)).toBe(serialize(reference))
    // A step after stopping does nothing.
    g.getState().trainStep(Infinity, 20)
    expect(g.getState().trained).toBe(40)
  })

  it('always plays at least one game per step, even with no time budget', () => {
    const g = newGame()
    g.getState().startTraining('random', 10)
    g.getState().trainStep(0, 20)
    expect(g.getState().training?.done).toBe(1)
    g.getState().stopTraining()
  })

  it('Perfect never loses to MENACE, and Itself runs', () => {
    const g = newGame(3)
    g.getState().startTraining('perfect', 200)
    runToEnd(g)
    expect(g.getState().speech).toMatch(/Won none/)
    g.getState().startTraining('itself', 100)
    runToEnd(g)
    expect(g.getState().trained).toBe(300)
    expect(curveTotal(g.getState().curve)).toBe(300)
  })

  it('player games and training share one curve', () => {
    const g = newGame()
    playOneGame(g)
    expect(curveTotal(g.getState().curve)).toBe(1)
    g.getState().startTraining('random', 20)
    runToEnd(g)
    playOneGame(g)
    const s = g.getState()
    expect(curveTotal(s.curve)).toBe(22)
    expect(s.games).toBe(2)
    expect(s.trained).toBe(20)
    expect(s.record.menace + s.record.draws + s.record.you).toBe(2)
  })

  it('reset clears the curve and the training count', () => {
    const g = newGame()
    g.getState().startTraining('random', 50)
    runToEnd(g)
    expect(g.getState().resetBrain()).toBe(true)
    expect(curveTotal(g.getState().curve)).toBe(0)
    expect(g.getState().trained).toBe(0)
  })
})

describe('training and the save', () => {
  it('saves once when a run ends, not on every chunk, and the curve survives a reload', () => {
    const storage = new FakeStorage()
    const g = newGame()
    attachPersistence(g, storage)
    g.getState().startTraining('random', 300)
    expect(storage.writes).toBe(0)
    runToEnd(g, 20)
    expect(storage.writes).toBe(1)
    const back = loadSave(storage)
    expect(back).not.toBeNull()
    expect(back!.curve).toEqual(g.getState().curve)
    expect(back!.trained).toBe(300)
    expect(serialize(back!.brain)).toBe(serialize(g.getState().brain))

    const reloaded = createGame({ saved: back!, rng: seeded(1) })
    expect(reloaded.getState().curve).toEqual(g.getState().curve)
    expect(reloaded.getState().trained).toBe(300)
  })

  it('a stopped run is saved too', () => {
    const storage = new FakeStorage()
    const g = newGame()
    attachPersistence(g, storage)
    g.getState().startTraining('random', 1000)
    g.getState().trainStep(Infinity, 20)
    g.getState().stopTraining()
    expect(storage.writes).toBe(1)
    expect(loadSave(storage)!.trained).toBe(20)
  })

  it('an older save without curve data still loads', () => {
    const storage = new FakeStorage()
    const g = newGame()
    attachPersistence(g, storage)
    playOneGame(g)
    const parsed = JSON.parse(storage.data.get(SAVE_KEY)!) as Record<string, unknown>
    delete parsed.curve
    delete parsed.trained
    storage.data.set(SAVE_KEY, JSON.stringify(parsed))
    const back = loadSave(storage)
    expect(back).not.toBeNull()
    expect(curveTotal(back!.curve)).toBe(0)
    expect(back!.trained).toBe(0)
  })

  it('a damaged curve is dropped and the brain is kept', () => {
    const storage = new FakeStorage()
    const g = newGame()
    attachPersistence(g, storage)
    playOneGame(g)
    const parsed = JSON.parse(storage.data.get(SAVE_KEY)!) as Record<string, unknown>
    parsed.curve = { per: 10, buckets: [[1, 2]], tail: [0, 0, 0] }
    storage.data.set(SAVE_KEY, JSON.stringify(parsed))
    const back = loadSave(storage)
    expect(back).not.toBeNull()
    expect(curveTotal(back!.curve)).toBe(0)
  })
})

describe('saving when the tab is left', () => {
  const fakes = () => {
    const win = new EventTarget()
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as string })
    return { win, doc }
  }

  it('writes the games played so far on pagehide, mid-run, whole games only', () => {
    const storage = new FakeStorage()
    const g = newGame(9)
    const { win, doc } = fakes()
    attachPersistence(g, storage)
    attachFlushOnLeave(g, storage, win, doc)
    g.getState().startTraining('random', 1000)
    g.getState().trainStep(Infinity, 20)
    g.getState().trainStep(Infinity, 20)
    expect(storage.writes).toBe(0)
    win.dispatchEvent(new Event('pagehide'))
    expect(storage.writes).toBe(1)
    const back = loadSave(storage)!
    expect(back.trained).toBe(40)
    expect(curveTotal(back.curve)).toBe(40)
    // The same 40 games a headless run makes: no half game in the brain.
    const reference = createMenace()
    train(reference, 40, randomOpponent, seeded(9))
    expect(serialize(back.brain)).toBe(serialize(reference))
  })

  it('writes when the page becomes hidden, and not when it becomes visible', () => {
    const storage = new FakeStorage()
    const g = newGame()
    const { win, doc } = fakes()
    attachFlushOnLeave(g, storage, win, doc)
    g.getState().startTraining('random', 1000)
    g.getState().trainStep(Infinity, 20)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(storage.writes).toBe(0)
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(storage.writes).toBe(1)
    expect(loadSave(storage)!.trained).toBe(20)
  })

  it('never writes in the middle of a game', () => {
    const storage = new FakeStorage()
    const g = newGame()
    const { win, doc } = fakes()
    attachFlushOnLeave(g, storage, win, doc)
    g.getState().start()
    g.getState().think()
    g.getState().land()
    expect(g.getState().phase).toBe('player')
    win.dispatchEvent(new Event('pagehide'))
    expect(storage.writes).toBe(0)
  })

  it('stops listening when told to', () => {
    const storage = new FakeStorage()
    const g = newGame()
    const { win, doc } = fakes()
    const off = attachFlushOnLeave(g, storage, win, doc)
    off()
    win.dispatchEvent(new Event('pagehide'))
    expect(storage.writes).toBe(0)
  })
})

describe('runs on the curve and the shimmer', () => {
  it('records a run when training starts, and marks where player games resume', () => {
    const g = newGame()
    playOneGame(g)
    expect(g.getState().curve.runs).toEqual([])
    g.getState().startTraining('perfect', 30)
    expect(g.getState().curve.runs).toEqual([{ start: 1, opponent: 'perfect' }])
    runToEnd(g)
    playOneGame(g)
    playOneGame(g)
    expect(g.getState().curve.runs).toEqual([
      { start: 1, opponent: 'perfect' },
      { start: 31, opponent: 'player' },
    ])
  })

  it('shimmer slots come from the end of the chunk, not the start', () => {
    const g = newGame(4)
    g.getState().startTraining('random', 1000)
    g.getState().trainStep(Infinity, 20)
    const hot = g.getState().training!.hot
    // Replay the same 20 games headlessly and collect the boxes of the last few.
    const brain = createMenace()
    const rng = seeded(4)
    const games = Array.from({ length: 20 }, () => playGame(brain, randomOpponent, rng))
    const lastFew = new Set(games.slice(-SHIMMER_GAMES).flatMap((x) => x.history.map((h) => boxIndex(brain, h.boxKey))))
    expect(new Set(hot)).toEqual(lastFew)
    g.getState().stopTraining()
  })
})
