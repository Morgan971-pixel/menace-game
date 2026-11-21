import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMenace, type Menace } from './menace'
import { createMirror } from './mirror'
import { winner, type Cell } from './board'
import { perfectMove, perfectOpponent, randomMove, randomOpponent } from './opponents'
import { seeded } from './rng'
import { setBeads, snapshot } from './testing'
import { playGame, train } from './trainer'

vi.mock('./menace', async (importOriginal) => {
  const real = await importOriginal<typeof import('./menace')>()
  return { ...real, learn: vi.fn((...args: Parameters<typeof real.learn>) => real.learn(...args)) }
})
import * as menaceModule from './menace'

const learnSpy = vi.mocked(menaceModule.learn)

beforeEach(() => {
  learnSpy.mockClear()
})

describe('playGame', () => {
  it('returns a finished game and calls learn exactly once, with its result', () => {
    const menace = createMenace()
    const g = playGame(menace, randomOpponent, seeded(1))
    expect(['X', 'O', 'D']).toContain(g.result)
    expect(learnSpy).toHaveBeenCalledTimes(1)
    expect(learnSpy.mock.calls[0][2]).toBe(g.result)
    expect(learnSpy.mock.calls[0][1]).toBe(g.history)
  })

  it('calls learn once per game over a whole run', () => {
    const menace = createMenace()
    const sum = train(menace, 150, randomOpponent, seeded(2))
    expect(sum.games).toBe(150)
    expect(learnSpy).toHaveBeenCalledTimes(150)
  })

  it('counts a resign as a loss and learns it once', () => {
    const menace = createMenace()
    // Empty the opening box: MENACE resigns on its first move with no history.
    setBeads(menace, '         ', Array<number>(9).fill(0))
    const g = playGame(menace, randomOpponent, seeded(3))
    expect(g.resigned).toBe(true)
    expect(g.result).toBe('O')
    expect(g.history).toEqual([])
    expect(learnSpy).toHaveBeenCalledTimes(1)
    expect(learnSpy.mock.calls[0][2]).toBe('O')
  })

  it('applies the reward to the boxes it used, once', () => {
    const menace = createMenace()
    const before = snapshot(menace)
    const g = playGame(menace, randomOpponent, seeded(4))
    const delta = g.result === 'X' ? 3 : g.result === 'D' ? 1 : -1
    for (const { boxKey, canonMove } of g.history) {
      const was = before.get(boxKey)![canonMove]
      // The same box and bead can appear only once in a game, so the change is a single delta.
      expect(menace.boxes.get(boxKey)![canonMove]).toBe(Math.max(0, was + delta))
    }
  })
})

describe('perfect opponent', () => {
  it('never loses to a random X: 1,000 seeded games', () => {
    const rng = seeded(10)
    for (let i = 0; i < 1000; i++) {
      const cells: Cell[] = Array<Cell>(9).fill(null)
      let end = winner(cells)
      while (end === null) {
        cells[randomMove(cells, rng)] = 'X'
        end = winner(cells)
        if (end !== null) break
        cells[perfectMove(cells, rng)] = 'O'
        end = winner(cells)
      }
      expect(end).not.toBe('X')
    }
  })

  it('never loses: 1,000 seeded games, each against a fresh MENACE', () => {
    const rng = seeded(11)
    let perfectLosses = 0
    for (let i = 0; i < 1000; i++) {
      // A MENACE win would be a perfect loss.
      const g = playGame(createMenace(), perfectOpponent, rng)
      if (g.result === 'X') perfectLosses++
    }
    expect(perfectLosses).toBe(0)
  })

  it('never loses against a fresh MENACE that keeps learning (1,000 games)', () => {
    const menace = createMenace()
    const rng = seeded(12)
    const sum = train(menace, 1000, perfectOpponent, rng)
    expect(sum.won).toBe(0)
    expect(sum.games).toBe(1000)
  })
})

describe('learning', () => {
  it('MENACE loses less to random by the end of 2,000 games than at the start', () => {
    for (const seed of [21, 22, 23]) {
      const menace = createMenace()
      const rng = seeded(seed)
      const lossAt: boolean[] = []
      train(menace, 2000, randomOpponent, rng, (g) => {
        lossAt.push(g.result === 'O')
      })
      const rate = (xs: boolean[]) => xs.filter(Boolean).length / xs.length
      const first = rate(lossAt.slice(0, 200))
      const last = rate(lossAt.slice(-200))
      expect(first - last).toBeGreaterThanOrEqual(0.03)
    }
  })

  it('stops early when onGame returns false', () => {
    const sum = train(createMenace(), 50, randomOpponent, seeded(5), (_g, i) => i < 9)
    expect(sum.games).toBe(10)
  })

  it('a mirror learns: its win rate rises against a fixed MENACE', () => {
    const fixed: Menace = createMenace()
    const frozen = snapshot(fixed)
    const restore = () => {
      for (const [k, v] of frozen) setBeads(fixed, k, v)
    }
    const mirror = createMirror()
    const rng = seeded(31)
    const mirrorWon: boolean[] = []
    for (let i = 0; i < 2000; i++) {
      const g = playGame(fixed, mirror, rng)
      restore()
      mirrorWon.push(g.result === 'O')
    }
    const rate = (xs: boolean[]) => xs.filter(Boolean).length / xs.length
    expect(rate(mirrorWon.slice(-200)) - rate(mirrorWon.slice(0, 200))).toBeGreaterThanOrEqual(0.05)
  })
})
