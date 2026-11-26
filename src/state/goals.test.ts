// Ticket 07: the record, MENACE's unbeaten streak, the one-time "it has learned" milestone,
// and challenge mode against a fresh brain that never touches the real one.
import { describe, expect, it } from 'vitest'
import { winner, type Cell } from '../engine/board'
import { createMenace, defaultConfig, serialize, type Menace } from '../engine/menace'
import { seeded } from '../engine/rng'
import { setBeads } from '../engine/testing'
import { emptyDish } from './dish'
import { BROKEN_MIN, CHALLENGE_WINS, STREAK_GOAL, createGame, type GameState } from './store'
import type { StoreApi } from 'zustand/vanilla'

const EMPTY = '         '

function newGame(seed = 1, brain?: Menace) {
  return createGame({ brain, rng: seeded(seed), lineRng: seeded(seed + 1000) })
}

/** True when O can keep from winning whatever X does from here. */
const safeMemo = new Map<string, boolean>()
function oCanStayOff(board: readonly Cell[], toMove: 'X' | 'O'): boolean {
  const w = winner(board)
  if (w !== null) return w !== 'O'
  const key = board.map((c) => c ?? '.').join('') + toMove
  const hit = safeMemo.get(key)
  if (hit !== undefined) return hit
  const empty = board.flatMap((c, i) => (c === null ? [i] : []))
  const after = (i: number) => {
    const next = board.slice()
    next[i] = toMove
    return oCanStayOff(next, toMove === 'X' ? 'O' : 'X')
  }
  const ok = toMove === 'O' ? empty.some(after) : empty.every(after)
  safeMemo.set(key, ok)
  return ok
}

/** A square for O that keeps O from ever winning, whatever MENACE plays. */
function quietSquare(board: readonly Cell[]): number {
  const empty = board.flatMap((c, i) => (c === null ? [i] : []))
  return empty.find((i) => {
    const next = board.slice()
    next[i] = 'O'
    return oCanStayOff(next, 'X')
  }) ?? empty[0]
}

/** Plays one game where O never takes a win, then closes the books. MENACE does not lose. */
function unbeaten(g: StoreApi<GameState>): void {
  g.getState().start()
  let guard = 0
  while (g.getState().phase !== 'ledger' && guard++ < 20) {
    const s = g.getState()
    if (s.phase === 'menace') {
      s.think()
      g.getState().land()
    } else if (s.phase === 'player') s.play(quietSquare(s.board))
  }
  expect(g.getState().result).not.toBe('O')
  g.getState().skipLedger()
}

/** A player win: the opening box is emptied for one game so MENACE resigns, then put back. */
function playerWin(g: StoreApi<GameState>): void {
  const brain = g.getState().brain
  const opening = [...(brain.boxes.get(EMPTY) ?? [])]
  setBeads(brain, EMPTY, Array(9).fill(0))
  g.getState().start()
  g.getState().think()
  expect(g.getState().result).toBe('O')
  g.getState().skipLedger()
  setBeads(brain, EMPTY, opening)
}

describe('record and streak', () => {
  it('wins and draws extend the streak; a player win ends it', () => {
    const g = newGame()
    unbeaten(g)
    unbeaten(g)
    expect(g.getState().streak).toBe(2)
    const r = g.getState().record
    expect(r.menace + r.draws).toBe(2)
    playerWin(g)
    expect(g.getState().streak).toBe(0)
    expect(g.getState().record.you).toBe(1)
    expect(g.getState().broke).toBe(0)
  })

  it('ending a long enough streak earns the broken-streak line', () => {
    const g = newGame(3)
    for (let i = 0; i < BROKEN_MIN; i++) unbeaten(g)
    const opening = [...(g.getState().brain.boxes.get(EMPTY) ?? [])]
    setBeads(g.getState().brain, EMPTY, Array(9).fill(0))
    g.getState().start()
    g.getState().think()
    expect(g.getState().broke).toBe(BROKEN_MIN)
    g.getState().skipLedger()
    setBeads(g.getState().brain, EMPTY, opening)
    expect(g.getState().speech).not.toBe('')
  })

  it('training never moves the streak', () => {
    const g = newGame()
    unbeaten(g)
    expect(g.getState().startTraining('random', 50)).toBe(true)
    while (g.getState().training !== null) g.getState().trainStep(1000, 1000)
    expect(g.getState().streak).toBe(1)
    expect(g.getState().learned).toBe(false)
  })
})

describe('"it has learned" milestone', () => {
  it('fires once, at the tenth unbeaten game, as the ledger closes', () => {
    const g = newGame(5)
    for (let i = 0; i < STREAK_GOAL - 1; i++) unbeaten(g)
    expect(g.getState().learned).toBe(false)
    expect(g.getState().milestone).toBe(0)

    g.getState().start()
    let guard = 0
    while (g.getState().phase !== 'ledger' && guard++ < 20) {
      const s = g.getState()
      if (s.phase === 'menace') { s.think(); g.getState().land() } else s.play(quietSquare(s.board))
    }
    // Earned when the game ends, but the beat waits for the books to close.
    expect(g.getState().learned).toBe(true)
    expect(g.getState().milestoneDue).toBe(true)
    expect(g.getState().milestone).toBe(0)
    g.getState().skipLedger()
    expect(g.getState().milestone).toBe(1)
    expect(g.getState().milestoneDue).toBe(false)
    expect(g.getState().curve.runs.at(-1)?.opponent).toBe('learned')
  })

  it('never fires again for the same brain, even after a broken and rebuilt streak', () => {
    const g = newGame(7)
    for (let i = 0; i < STREAK_GOAL; i++) unbeaten(g)
    expect(g.getState().milestone).toBe(1)
    playerWin(g)
    for (let i = 0; i < STREAK_GOAL + 2; i++) unbeaten(g)
    expect(g.getState().streak).toBe(STREAK_GOAL + 2)
    expect(g.getState().milestone).toBe(1)
  })

  it('a reset or an imported brain can earn it again', () => {
    const g = newGame(9)
    for (let i = 0; i < STREAK_GOAL; i++) unbeaten(g)
    expect(g.getState().resetBrain()).toBe(true)
    expect(g.getState().learned).toBe(false)
    expect(g.getState().streak).toBe(0)
    for (let i = 0; i < STREAK_GOAL; i++) unbeaten(g)
    expect(g.getState().milestone).toBe(2)
    expect(g.getState().importBrain(createMenace())).toBe(true)
    expect(g.getState().learned).toBe(false)
    expect(g.getState().streak).toBe(0)
  })
})

describe('challenge mode', () => {
  /** A real machine with some history, so a leak would show. */
  function seasoned() {
    const g = newGame(11)
    unbeaten(g)
    playerWin(g)
    unbeaten(g)
    return g
  }

  it('plays on its own fresh brain and puts the real one back untouched', () => {
    const g = seasoned()
    const s0 = g.getState()
    const real = s0.brain
    const realBoxes = serialize(real)
    const kept = { record: s0.record, dish: s0.dish, curve: s0.curve, games: s0.games, streak: s0.streak, learned: s0.learned, trained: s0.trained }

    expect(g.getState().startChallenge()).toBe(true)
    const c = g.getState()
    expect(c.phase).toBe('menace')
    expect(c.brain).not.toBe(real)
    expect(c.brain.boxes.size).toBe(304)
    expect(c.brain.config).toEqual(defaultConfig('1961'))
    expect(c.record).toEqual({ menace: 0, draws: 0, you: 0 })
    expect(c.dish).toEqual(emptyDish())
    expect(c.streak).toBe(0)

    // Finish the first game, then play more on the challenge brain.
    let guard = 0
    while (g.getState().phase !== 'ledger' && guard++ < 20) {
      const s = g.getState()
      if (s.phase === 'menace') { s.think(); g.getState().land() } else s.play(quietSquare(s.board))
    }
    g.getState().skipLedger()
    unbeaten(g)
    playerWin(g)
    expect(serialize(real)).toBe(realBoxes)

    expect(g.getState().endChallenge()).toBe(true)
    const e = g.getState()
    expect(e.challenge).toBeNull()
    expect(e.phase).toBe('title')
    expect(e.brain).toBe(real)
    expect(serialize(e.brain)).toBe(realBoxes)
    expect({ record: e.record, dish: e.dish, curve: e.curve, games: e.games, streak: e.streak, learned: e.learned, trained: e.trained }).toEqual(kept)
  })

  it(`is won on the player's ${CHALLENGE_WINS}rd win, saved as the best, and then only End leaves it`, () => {
    const g = newGame(13)
    g.getState().startChallenge()
    // The challenge's first game is already on: empty the fresh brain's opening box so MENACE resigns every game.
    setBeads(g.getState().brain, EMPTY, Array(9).fill(0))
    g.getState().think()
    g.getState().skipLedger()
    for (let i = 1; i < CHALLENGE_WINS; i++) {
      expect(g.getState().challenge?.outcome).toBeNull()
      g.getState().start()
      g.getState().think()
      g.getState().skipLedger()
    }
    const s = g.getState()
    expect(s.record.you).toBe(CHALLENGE_WINS)
    expect(s.challenge?.outcome).toBe('won')
    expect(s.challengeBest.won).toBe(CHALLENGE_WINS)
    expect(s.speech).not.toBe('')
    // The result stays on screen: no new game, no wipe, no training.
    s.start()
    expect(g.getState().phase).toBe('over')
    expect(g.getState().resetBrain()).toBe(false)
    expect(g.getState().startTraining('random', 10)).toBe(false)
    expect(g.getState().endChallenge()).toBe(true)
    // The best result outlives the challenge.
    expect(g.getState().challengeBest.won).toBe(CHALLENGE_WINS)
  })

  it(`is lost when the fresh machine goes ${STREAK_GOAL} unbeaten, and never fires the real milestone`, () => {
    const g = newGame(17)
    g.getState().startChallenge()
    let guard = 0
    while (g.getState().phase !== 'ledger' && guard++ < 20) {
      const s = g.getState()
      if (s.phase === 'menace') { s.think(); g.getState().land() } else s.play(quietSquare(s.board))
    }
    g.getState().skipLedger()
    for (let i = 1; i < STREAK_GOAL; i++) unbeaten(g)
    const s = g.getState()
    expect(s.challenge?.outcome).toBe('lost')
    expect(s.learned).toBe(false)
    expect(s.milestone).toBe(0)
    expect(s.challengeBest.survived).toBe(STREAK_GOAL)
    g.getState().endChallenge()
    expect(g.getState().learned).toBe(false)
    expect(g.getState().milestone).toBe(0)
  })

  it('locks out every action that would touch the real brain while it runs', () => {
    const g = newGame(19)
    g.getState().startChallenge()
    g.getState().think()
    g.getState().land()
    // Mid-game: nothing between-games works, and End waits for the game to finish.
    expect(g.getState().endChallenge()).toBe(false)
    expect(g.getState().startChallenge()).toBe(false)
    let guard = 0
    while (g.getState().phase !== 'ledger' && guard++ < 20) {
      const s = g.getState()
      if (s.phase === 'menace') { s.think(); g.getState().land() } else s.play(quietSquare(s.board))
    }
    g.getState().skipLedger()
    expect(g.getState().resetBrain()).toBe(false)
    expect(g.getState().importBrain(createMenace())).toBe(false)
    expect(g.getState().applyConfig(defaultConfig('engine'))).toBe(false)
    expect(g.getState().startTraining('random', 10)).toBe(false)
    expect(g.getState().startChallenge()).toBe(false)
  })
})
