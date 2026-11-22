import { describe, expect, it } from 'vitest'
import { canonicalize, type Cell } from '../engine/board'
import { boxIndex, createMenace, defaultConfig, inspect, serialize, type Menace } from '../engine/menace'
import { ALL_KEYS } from '../engine/slots'
import { seeded } from '../engine/rng'
import { setBeads, snapshot } from '../engine/testing'
import { ledgerLine } from './lines'
import { dishTotal, emptyDish } from './dish'
import { createGame, winningLine, type GameState, type LedgerItem } from './store'
import type { StoreApi } from 'zustand/vanilla'

function newGame(seed = 1) {
  return createGame({ rng: seeded(seed), lineRng: seeded(seed + 1000) })
}

/** One MENACE move: think, then land (what the director and the scene do). */
function menaceMoves(g: StoreApi<GameState>) {
  g.getState().think()
  g.getState().land()
}

/** Plays until the game ends (the ledger opens), O always taking the first empty square. */
function playToLedger(g: StoreApi<GameState>): void {
  let guard = 0
  while (g.getState().phase !== 'ledger' && guard++ < 20) {
    const s = g.getState()
    if (s.phase === 'menace') menaceMoves(g)
    else if (s.phase === 'player') s.play(s.board.findIndex((c) => c === null))
  }
  expect(g.getState().phase).toBe('ledger')
}

/** Steps through the ledger the way the scene does, one item at a time. Returns the items seen. */
function watchLedger(g: StoreApi<GameState>): number[] {
  const seen: number[] = []
  let guard = 0
  while (g.getState().phase === 'ledger' && guard++ < 20) {
    const at = g.getState().ledgerAt
    if (at >= 0) seen.push(at)
    g.getState().ledgerNext(at)
  }
  return seen
}

/** Plays a whole game to 'over', then watches or skips the ledger. */
function playOut(g: StoreApi<GameState>, ledger: 'watch' | 'skip' = 'skip'): void {
  playToLedger(g)
  if (ledger === 'watch') watchLedger(g)
  else g.getState().skipLedger()
  expect(g.getState().phase).toBe('over')
}

/** A frozen copy of a brain, for inspect() on the state before learning. */
const cloneBrain = (m: Menace): Menace => ({ config: m.config, boxes: snapshot(m) })

describe('phase flow', () => {
  it('starts on the title with an empty board and a fresh 1961 brain', () => {
    const s = newGame().getState()
    expect(s.phase).toBe('title')
    expect(s.board).toEqual(Array(9).fill(null))
    expect(s.brain.boxes.size).toBe(304)
    expect(s.record).toEqual({ menace: 0, draws: 0, you: 0 })
  })

  it('start -> menace; think shows the box; land places X and hands over to the player', () => {
    const g = newGame()
    g.getState().start()
    expect(g.getState().phase).toBe('menace')
    expect(g.getState().turn).toBeNull()

    g.getState().think()
    const t = g.getState().turn!
    expect(t.forced).toBe(false)
    expect(t.boxKey).toBe('         ')
    expect(t.slot).toBe(0)
    expect(g.getState().boxOut).toBe(true)
    expect(g.getState().board.every((c) => c === null)).toBe(true) // not placed until land
    expect(g.getState().speech).toMatch(/Box 1\b/)

    g.getState().land()
    const s = g.getState()
    expect(s.phase).toBe('player')
    expect(s.board.filter((c) => c === 'X')).toHaveLength(1)
    expect(s.board[t.square]).toBe('X')
    expect(s.history).toHaveLength(1)
  })

  it('turn beads are the real-square beads from inspect before the draw, and sure is the chosen share', () => {
    const g = newGame(7)
    g.getState().start()
    menaceMoves(g)
    g.getState().play(g.getState().board.findIndex((c) => c === null))
    const board = g.getState().board.slice()
    const expected = inspect(g.getState().brain, board)
    g.getState().think()
    const t = g.getState().turn!
    expect(t.beads).toEqual(expected.beads)
    expect(t.boxKey).toBe(expected.boxKey)
    expect(t.slot).toBe(boxIndex(g.getState().brain, t.boxKey!))
    const total = expected.beads.reduce<number>((a, b) => a + (b ?? 0), 0)
    expect(t.sure).toBeCloseTo((expected.beads[t.square] ?? 0) / total)
    expect(board[t.square]).toBeNull()
  })

  it('ignores out-of-turn input: play during MENACE turn, land twice, think twice, occupied squares', () => {
    const g = newGame()
    g.getState().start()
    g.getState().play(0)
    expect(g.getState().board.every((c) => c === null)).toBe(true)
    g.getState().think()
    const first = g.getState().turn
    g.getState().think()
    expect(g.getState().turn).toBe(first)
    g.getState().land()
    g.getState().land()
    expect(g.getState().board.filter(Boolean)).toHaveLength(1)
    const x = g.getState().board.indexOf('X')
    g.getState().play(x)
    expect(g.getState().board[x]).toBe('X')
    expect(g.getState().phase).toBe('player')
    g.getState().play(9)
    g.getState().play(-1)
    expect(g.getState().phase).toBe('player')
  })

  it('a non-forced move does not start until the previous turn has landed', () => {
    const g = newGame()
    g.getState().start()
    g.getState().think()
    const id = g.getState().turn!.id
    g.getState().think()
    expect(g.getState().turn!.id).toBe(id)
  })

  it('move 5 is forced: no box, sure = 1, the last empty square', () => {
    // O always takes the first empty square; some seeds end before move 5, so search for one that gets there.
    let forcedSeen = false
    for (let seed = 1; seed <= 60 && !forcedSeen; seed++) {
      const g = newGame(seed)
      g.getState().start()
      let guard = 0
      while (g.getState().phase !== 'ledger' && guard++ < 20) {
        const s = g.getState()
        if (s.phase === 'player') {
          s.play(s.board.findIndex((c) => c === null))
          continue
        }
        s.boxHome() // the director waits for the previous box to return before thinking
        s.think()
        const t = g.getState().turn
        if (g.getState().phase === 'menace' && t?.forced) {
          forcedSeen = true
          expect(t.boxKey).toBeNull()
          expect(t.slot).toBe(-1)
          expect(t.sure).toBe(1)
          expect(g.getState().board.filter((c) => c === null)).toHaveLength(1)
          expect(g.getState().board[t.square]).toBeNull()
          expect(g.getState().boxOut).toBe(false)
          g.getState().land()
          expect(g.getState().phase).toBe('ledger')
          expect(g.getState().history).toHaveLength(4) // the forced move is not learned
          expect(g.getState().ledger).toHaveLength(4) // and has no box to show
        } else g.getState().land()
      }
    }
    expect(forcedSeen).toBe(true)
  })

  it('boxHome clears boxOut', () => {
    const g = newGame()
    g.getState().start()
    g.getState().think()
    expect(g.getState().boxOut).toBe(true)
    g.getState().boxHome()
    expect(g.getState().boxOut).toBe(false)
  })
})

describe('game over and learning', () => {
  it('learns exactly once with the result from MENACE side, and updates the record', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = newGame(seed)
      g.getState().start()
      const before = snapshot(g.getState().brain)
      playOut(g)
      const s = g.getState()
      expect(s.phase).toBe('over')
      expect(s.result).not.toBeNull()
      const delta = s.result === 'X' ? 3 : s.result === 'D' ? 1 : -1
      const after = snapshot(s.brain)
      const touched = new Set(s.history.map((h) => h.boxKey))
      expect(touched.size).toBe(s.history.length) // one entry per box
      for (const h of s.history) {
        const was = before.get(h.boxKey)![h.canonMove]
        expect(after.get(h.boxKey)![h.canonMove]).toBe(Math.max(0, was + delta))
      }
      for (const [key, beads] of after) if (!touched.has(key)) expect(beads).toEqual(before.get(key))

      // Further input after the game cannot learn again.
      const frozen = snapshot(s.brain)
      s.think()
      s.land()
      s.play(0)
      expect(snapshot(g.getState().brain)).toEqual(frozen)

      const r = s.record
      expect(r.menace + r.draws + r.you).toBe(1)
      expect(r.menace).toBe(s.result === 'X' ? 1 : 0)
      expect(r.you).toBe(s.result === 'O' ? 1 : 0)
      expect(r.draws).toBe(s.result === 'D' ? 1 : 0)
      expect(s.games).toBe(1)
    }
  })

  it('records the winning line on a win and none on a draw', () => {
    let sawWin = false
    for (let seed = 1; seed <= 40; seed++) {
      const g = newGame(seed)
      g.getState().start()
      playOut(g)
      const s = g.getState()
      if (s.result === 'D') expect(s.winLine).toBeNull()
      else {
        sawWin = true
        expect(s.winLine).toEqual(winningLine(s.board))
        const [a, b, c] = s.winLine!
        expect(s.board[a]).toBe(s.board[b])
        expect(s.board[b]).toBe(s.board[c])
      }
    }
    expect(sawWin).toBe(true)
  })

  it('record accumulates over several games and Play again resets the board', () => {
    const g = newGame(11)
    for (let n = 1; n <= 5; n++) {
      g.getState().start()
      expect(g.getState().board.every((c) => c === null)).toBe(true)
      expect(g.getState().history).toEqual([])
      playOut(g)
      const r = g.getState().record
      expect(r.menace + r.draws + r.you).toBe(n)
      expect(g.getState().games).toBe(n)
    }
  })

  it('start is ignored mid-game', () => {
    const g = newGame()
    g.getState().start()
    menaceMoves(g)
    const board = g.getState().board.slice()
    g.getState().start()
    expect(g.getState().board).toEqual(board)
    expect(g.getState().phase).toBe('player')
  })
})

describe('resign', () => {
  it('an empty first box resigns at once: MENACE loses, nothing to learn', () => {
    const brain = createMenace()
    setBeads(brain, '         ', Array(9).fill(0))
    const g = createGame({ brain, rng: seeded(1), lineRng: seeded(2) })
    g.getState().start()
    g.getState().think()
    const s = g.getState()
    expect(s.phase).toBe('ledger')
    expect(s.result).toBe('O')
    expect(s.resigned).toBe(true)
    expect(s.record).toEqual({ menace: 0, draws: 0, you: 1 })
    expect(s.speech).toMatch(/Box 1\b/)
    expect(s.speech).toMatch(/resign|win/i)
    expect(s.turn).toBeNull()
    // The ledger shows only the empty box that made it resign.
    expect(s.ledger).toEqual([
      { kind: 'resign', slot: 0, boxKey: '         ', square: null, board: Array(9).fill(null),
        before: Array(9).fill(0), after: Array(9).fill(0), delta: 0 },
    ])
    s.skipLedger()
    expect(g.getState().phase).toBe('over')
    expect(g.getState().speech).toMatch(/Box 1\b/)
    expect(g.getState().dish).toEqual(emptyDish())
  })

  it('a later empty box resigns and confiscates the beads MENACE drew earlier (learn with O)', () => {
    const g = newGame(5)
    g.getState().start()
    menaceMoves(g)
    const s1 = g.getState()
    s1.play(s1.board.findIndex((c) => c === null))
    const first = g.getState().history[0]
    const was = g.getState().brain.boxes.get(first.boxKey)![first.canonMove]
    const board: Cell[] = g.getState().board.slice()
    const { key } = canonicalize(board)
    setBeads(g.getState().brain, key, Array(9).fill(0))

    g.getState().think()
    const s = g.getState()
    expect(s.phase).toBe('ledger')
    expect(s.result).toBe('O')
    expect(s.resigned).toBe(true)
    expect(s.speech).toContain(`Box ${boxIndex(s.brain, key) + 1}`)
    expect(s.brain.boxes.get(first.boxKey)![first.canonMove]).toBe(was - 1)
    expect(s.record.you).toBe(1)
    // Ledger: the box it drew from (one bead confiscated), then the empty box, last.
    expect(s.ledger.map((i) => i.kind)).toEqual(['reward', 'resign'])
    expect(s.ledger[0].delta).toBe(-1)
    expect(s.ledger[1].slot).toBe(boxIndex(s.brain, key))
    expect(s.ledger[1].board).toEqual(board)
    expect(s.ledger[1].after.every((b) => b === null || b === 0)).toBe(true)
    expect(watchLedger(g)).toEqual([0, 1])
    expect(g.getState().dish.tail).toEqual([s.ledger[0].square])
    expect(dishTotal(g.getState().dish)).toBe(1)
  })
})

describe('ledger', () => {
  /** Expected bead change for one result from MENACE's side (1961 rewards). */
  const deltaFor = (r: GameState['result']) => (r === 'X' ? 3 : r === 'D' ? 1 : -1)

  it('a finished game opens the ledger, then closes to over; nothing else happens on the way', () => {
    const g = newGame(3)
    g.getState().start()
    playToLedger(g)
    const s = g.getState()
    expect(s.phase).toBe('ledger')
    expect(s.ledgerAt).toBe(-1)
    expect(s.ledger.length).toBeGreaterThan(0)
    // Game input is ignored during the ledger.
    const board = s.board.slice()
    s.play(board.findIndex((c) => c === null))
    s.think()
    s.start()
    expect(g.getState().board).toEqual(board)
    expect(g.getState().phase).toBe('ledger')
    // Stale or out-of-order steps are ignored.
    s.ledgerNext(2)
    expect(g.getState().ledgerAt).toBe(-1)
    expect(watchLedger(g)).toEqual(s.ledger.map((_, i) => i))
    expect(g.getState().phase).toBe('over')
    expect(g.getState().ledgerAt).toBe(s.ledger.length)
    // Once over, ledger calls do nothing, and Play again starts a fresh game.
    g.getState().ledgerNext(g.getState().ledgerAt)
    g.getState().skipLedger()
    expect(g.getState().phase).toBe('over')
    g.getState().start()
    expect(g.getState().phase).toBe('menace')
    expect(g.getState().ledger).toEqual([])
  })

  it('learns once, when the ledger opens, with the result from MENACE side', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = newGame(seed)
      g.getState().start()
      const start = snapshot(g.getState().brain)
      playToLedger(g)
      const s = g.getState()
      const opened = snapshot(s.brain)
      for (const h of s.history) {
        const was = start.get(h.boxKey)![h.canonMove]
        expect(opened.get(h.boxKey)![h.canonMove]).toBe(Math.max(0, was + deltaFor(s.result)))
      }
      watchLedger(g)
      expect(snapshot(g.getState().brain)).toEqual(opened) // watching does not learn again
    }
  })

  it('every box used is shown in order, with before/after equal to what inspect reports', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = newGame(seed)
      g.getState().start()
      const frozen = cloneBrain(g.getState().brain)
      playToLedger(g)
      const s = g.getState()
      const items = s.ledger.filter((i) => i.kind === 'reward')
      expect(items).toHaveLength(s.history.length)
      items.forEach((item: LedgerItem, k) => {
        const h = s.history[k]
        expect(item.slot).toBe(h.slot)
        expect(item.slot).toBe(boxIndex(s.brain, h.boxKey))
        expect(item.square).toBe(h.square)
        expect(item.board).toEqual(h.board)
        expect(item.board[item.square!]).toBeNull()
        expect(inspect(frozen, item.board)).toEqual({ boxKey: h.boxKey, beads: item.before })
        expect(inspect(s.brain, item.board)).toEqual({ boxKey: h.boxKey, beads: item.after })
        expect(item.delta).toBe(deltaFor(s.result))
        item.after.forEach((b, sq) => {
          if (sq === item.square) expect(b).toBe((item.before[sq] ?? 0) + item.delta)
          else expect(b).toBe(item.before[sq])
        })
      })
    }
  })

  it('the ledger text reads like "Box N: +3 red (square 7)"', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame(seed)
      g.getState().start()
      playToLedger(g)
      for (const item of g.getState().ledger) {
        const sign = item.delta > 0 ? '\\+' : '-'
        expect(ledgerLine(item)).toMatch(new RegExp(`^Box ${item.slot + 1}: ${sign}\\d [a-z]+ \\(square ${item.square! + 1}\\)$`))
      }
    }
  })

  it('skipping lands in exactly the same state as watching, game after game', () => {
    const watched = newGame(21)
    const skipped = newGame(21)
    for (let n = 0; n < 12; n++) {
      for (const g of [watched, skipped]) g.getState().start()
      playOut(watched, 'watch')
      playOut(skipped, 'skip')
      const a = watched.getState()
      const b = skipped.getState()
      expect(serialize(b.brain)).toBe(serialize(a.brain))
      for (const k of ['phase', 'board', 'result', 'resigned', 'winLine', 'record', 'speech', 'games', 'ledger', 'ledgerAt', 'dish', 'history'] as const) {
        expect(b[k]).toEqual(a[k])
      }
    }
    expect(watched.getState().games).toBe(12)
  })

  it('confiscated beads go to the dish when the game ends, one per box on a loss; closing the ledger only flips the phase', () => {
    let sawLoss = false
    for (let seed = 1; seed <= 40 && !sawLoss; seed++) {
      const g = newGame(seed)
      g.getState().start()
      playToLedger(g)
      if (g.getState().result !== 'O') continue
      sawLoss = true
      const after = g.getState().dish
      expect(after.tail).toEqual(g.getState().history.map((h) => h.square))
      expect(dishTotal(after)).toBe(g.getState().history.length)
      // The dish as it was before the game stays available for the ledger replay.
      expect(g.getState().dishBefore).toEqual(emptyDish())
      g.getState().skipLedger()
      expect(g.getState().dish).toBe(after)
    }
    expect(sawLoss).toBe(true)
  })

  it('speed is 1, 2 or 4 and survives games', () => {
    const g = newGame()
    expect(g.getState().speed).toBe(1)
    g.getState().setSpeed(4)
    expect(g.getState().speed).toBe(4)
    g.getState().setSpeed(3 as never)
    expect(g.getState().speed).toBe(4)
    g.getState().start()
    playOut(g)
    expect(g.getState().speed).toBe(4)
  })
})


/** start() then play one whole game to the over screen. */
function playGame1(g: StoreApi<GameState>): void {
  g.getState().start()
  playOut(g)
}

describe('applyConfig (Tinker)', () => {
  const engineCfg = defaultConfig('engine')

  it('switching rule set wipes the brain, record, curve and dish, and says so', () => {
    const g = newGame()
    playGame1(g)
    expect(g.getState().games).toBe(1)
    expect(g.getState().applyConfig(engineCfg)).toBe(true)
    const s = g.getState()
    expect(s.brain.config.rules).toBe('engine')
    expect(s.brain.boxes.size).toBe(0)
    expect(s.record).toEqual({ menace: 0, draws: 0, you: 0 })
    expect(s.games).toBe(0)
    expect(s.trained).toBe(0)
    expect(dishTotal(s.dish)).toBe(0)
    expect(s.speech.length).toBeGreaterThan(0)
  })

  it('switching back gives 304 boxes with beads 4/3/2/1', () => {
    const g = newGame()
    g.getState().applyConfig(engineCfg)
    expect(g.getState().applyConfig(defaultConfig('1961'))).toBe(true)
    const b = g.getState().brain
    expect(b.boxes.size).toBe(304)
    const stage = (n: number) => [...b.boxes].find(([k]) => [...k].filter((c) => c === 'X').length === n)![1]
    expect(Math.max(...stage(0))).toBe(4)
    expect(Math.max(...stage(1))).toBe(3)
    expect(Math.max(...stage(2))).toBe(2)
    expect(Math.max(...stage(3))).toBe(1)
  })

  it('new starting beads also wipe, and a reset keeps the settings', () => {
    const g = newGame()
    playGame1(g)
    expect(g.getState().applyConfig({ ...defaultConfig('1961'), startBeads: [8, 6, 4, 2] })).toBe(true)
    expect(g.getState().games).toBe(0)
    expect(g.getState().brain.config.startBeads).toEqual([8, 6, 4, 2])
    expect(Math.max(...[...g.getState().brain.boxes.values()][0])).toBe(8)
    playGame1(g)
    expect(g.getState().resetBrain()).toBe(true)
    expect(g.getState().brain.config.startBeads).toEqual([8, 6, 4, 2])
    expect(g.getState().games).toBe(0)
  })

  it('changing only the rewards keeps every bead, the record and the curve', () => {
    const g = newGame()
    playGame1(g)
    playGame1(g)
    const before = snapshot(g.getState().brain)
    const record = g.getState().record
    const curve = g.getState().curve
    expect(g.getState().applyConfig({ ...defaultConfig('1961'), rewards: { win: 10, draw: 10, loss: -10 } })).toBe(true)
    const s = g.getState()
    expect(snapshot(s.brain)).toEqual(before)
    expect(s.record).toBe(record)
    // Results before and after the change are told apart by a marker at the current game count.
    expect(s.curve.runs.at(-1)).toEqual({ start: 2, opponent: 'tinker' })
    expect(s.curve.buckets).toEqual(curve.buckets)
    expect(s.curve.tail).toEqual(curve.tail)
    expect(s.brain.config.rewards).toEqual({ win: 10, draw: 10, loss: -10 })
  })

  it('the next game learns with the new rewards and the ledger shows the new deltas', () => {
    const g = newGame(3)
    g.getState().applyConfig({ ...defaultConfig('1961'), startBeads: [20, 20, 20, 20], rewards: { win: 10, draw: 10, loss: -10 } })
    playGame1(g)
    const items = g.getState().ledger.filter((i) => i.kind === 'reward')
    expect(items.length).toBeGreaterThan(0)
    const want = g.getState().result === 'O' ? -10 : 10
    for (const item of items) expect(item.delta).toBe(want)
  })

  it('refuses out-of-range settings, no-ops, mid-game and mid-training', () => {
    const g = newGame()
    const before = g.getState().brain
    expect(g.getState().applyConfig({ ...defaultConfig('1961'), rewards: { win: 1e300, draw: 1, loss: -1 } })).toBe(false)
    expect(g.getState().applyConfig({ ...defaultConfig('1961'), startBeads: [21, 3, 2, 1] })).toBe(false)
    expect(g.getState().applyConfig({ ...defaultConfig('1961'), rewards: { win: NaN, draw: 1, loss: -1 } })).toBe(false)
    expect(g.getState().applyConfig(defaultConfig('1961'))).toBe(false)
    expect(g.getState().brain).toBe(before)
    g.getState().start()
    expect(g.getState().applyConfig(defaultConfig('engine'))).toBe(false)
    const t = newGame()
    t.getState().startTraining('random', 10)
    expect(t.getState().applyConfig(defaultConfig('engine'))).toBe(false)
  })
})

describe('engine rules in the store', () => {
  it('boxes are made as play goes, each at its fixed slot, and the ledger uses those slots', () => {
    const g = createGame({ rng: seeded(4), lineRng: seeded(5), brain: createMenace(defaultConfig('engine')) })
    expect(g.getState().brain.boxes.size).toBe(0)
    let made = 0
    for (let i = 0; i < 3; i++) {
      playGame1(g)
      const s = g.getState()
      expect(s.brain.boxes.size).toBeGreaterThan(made)
      made = s.brain.boxes.size
      for (const item of s.ledger) {
        expect(item.slot).toBeGreaterThanOrEqual(0)
        expect(ALL_KEYS[item.slot]).toBe(item.boxKey)
      }
      expect(s.resigned).toBe(false)
    }
    expect(g.getState().games).toBe(3)
  })

  it('training 1000 games grows the cabinet and every shimmer slot is a real slot', () => {
    const g = createGame({ rng: seeded(8), lineRng: seeded(9), brain: createMenace(defaultConfig('engine')) })
    expect(g.getState().startTraining('random', 1000)).toBe(true)
    while (g.getState().training !== null) {
      g.getState().trainStep(1000, 50)
      for (const slot of g.getState().training?.hot ?? []) {
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(338)
      }
    }
    expect(g.getState().brain.boxes.size).toBeGreaterThan(250)
    expect(g.getState().brain.boxes.size).toBeLessThanOrEqual(338)
  })
})
