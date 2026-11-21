import { describe, expect, it } from 'vitest'
import { legalMoves, winner, type Cell } from './board'
import { createMirror, MIRROR_FLOOR, MIRROR_START_BEADS } from './mirror'
import { perfectMove, randomMove } from './opponents'
import { seeded } from './rng'
import { fromString } from './testing'

describe('randomMove', () => {
  it('always returns an empty square and reaches every one of them', () => {
    const board = fromString('X O  X   ')
    const rng = seeded(7)
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) {
      const m = randomMove(board, rng)
      expect(board[m]).toBeNull()
      seen.add(m)
    }
    expect([...seen].sort()).toEqual(legalMoves(board))
  })
})

describe('perfectMove', () => {
  it('takes a win when it has one', () => {
    // O O at 3, 4; the win is square 5. X threatens too, but a win comes first.
    const board = fromString('XX OO  X ')
    expect(perfectMove(board, seeded(1))).toBe(5)
  })

  it('blocks X when X threatens to win and O cannot win', () => {
    const board = fromString('XX  O    ')
    for (let seed = 1; seed < 20; seed++) expect(perfectMove(board, seeded(seed))).toBe(2)
  })

  it('answers a centre opening in a corner, and varies which corner', () => {
    const board = fromString('    X    ')
    const seen = new Set<number>()
    for (let seed = 1; seed < 60; seed++) seen.add(perfectMove(board, seeded(seed)))
    for (const m of seen) expect([0, 2, 6, 8]).toContain(m)
    expect(seen.size).toBeGreaterThan(1)
  })

  it('never plays an occupied square', () => {
    const board: Cell[] = fromString('XOX OX    ')
    expect(board[perfectMove(board, seeded(3))]).toBeNull()
  })
})

describe('createMirror', () => {
  it('opens a box per position on demand, with 4 beads on each empty square and none elsewhere', () => {
    const mirror = createMirror()
    expect(mirror.boxes.size).toBe(0)
    const board = fromString('    X    ')
    const m = mirror.move(board, seeded(1))
    expect(board[m]).toBeNull()
    expect(mirror.boxes.size).toBe(1)
    const [key, beads] = [...mirror.boxes][0]
    beads.forEach((b, i) => expect(b).toBe(key[i] === ' ' ? MIRROR_START_BEADS : 0))
  })

  it('merges symmetric positions into one box', () => {
    const mirror = createMirror()
    mirror.move(fromString('X        '), seeded(1))
    mirror.move(fromString('        X'), seeded(2))
    mirror.move(fromString('  X      '), seeded(3))
    expect(mirror.boxes.size).toBe(1)
  })

  it('maps the drawn bead back to the real square for rotated boards', () => {
    const mirror = createMirror()
    for (const board of [fromString('  X      '), fromString('      X  '), fromString('X  O  X  ')]) {
      for (let seed = 1; seed < 30; seed++) expect(board[mirror.move(board, seeded(seed))]).toBeNull()
    }
  })

  it('rewards by +3 / +1 / -1 from O side with a floor of 1', () => {
    const board = fromString('    X    ')
    const bump = (result: 'X' | 'O' | 'D') => {
      const mirror = createMirror()
      const m = mirror.move(board, seeded(1))
      mirror.finish?.(result)
      const [key, beads] = [...mirror.boxes][0]
      const total = beads.reduce((a, b) => a + b, 0)
      return { total, key, beads, m }
    }
    expect(bump('O').total).toBe(8 * 4 + 3) // O (the mirror) won
    expect(bump('D').total).toBe(8 * 4 + 1)
    expect(bump('X').total).toBe(8 * 4 - 1) // MENACE won
  })

  it('never empties a box, however many losses', () => {
    const mirror = createMirror()
    const board = fromString('    X    ')
    const rng = seeded(5)
    for (let n = 0; n < 300; n++) {
      mirror.move(board, rng)
      mirror.finish?.('X')
    }
    for (const beads of mirror.boxes.values()) {
      expect(beads.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
      beads.forEach((b) => {
        if (b !== 0) expect(b).toBeGreaterThanOrEqual(MIRROR_FLOOR)
      })
    }
  })

  it('clears its history after finish, so a second finish changes nothing', () => {
    const mirror = createMirror()
    mirror.move(fromString('    X    '), seeded(1))
    mirror.finish?.('O')
    const once = [...mirror.boxes.values()].map((b) => [...b])
    mirror.finish?.('O')
    expect([...mirror.boxes.values()]).toEqual(once)
  })
})

/** Value of a position for O with no memo table: 1 O wins, 0 draw, -1 X wins. Independent of opponents.ts. */
function slowValue(cells: readonly Cell[], turn: 'X' | 'O'): number {
  const end = winner(cells)
  if (end !== null) return end === 'O' ? 1 : end === 'X' ? -1 : 0
  let best = turn === 'O' ? -2 : 2
  for (const m of legalMoves(cells)) {
    const next = cells.slice()
    next[m] = turn
    const v = slowValue(next, turn === 'O' ? 'X' : 'O')
    best = turn === 'O' ? Math.max(best, v) : Math.min(best, v)
  }
  return best
}

/** Every position reachable in legal play with O to move and the game still going. */
function oToMovePositions(): Cell[][] {
  const out = new Map<string, Cell[]>()
  const walk = (cells: Cell[], turn: 'X' | 'O') => {
    if (winner(cells) !== null) return
    const id = cells.map((c) => c ?? ' ').join('')
    if (turn === 'O') {
      if (out.has(id)) return
      out.set(id, cells)
    }
    for (const m of legalMoves(cells)) {
      const next = cells.slice()
      next[m] = turn
      walk(next, turn === 'X' ? 'O' : 'X')
    }
  }
  walk(Array<Cell>(9).fill(null), 'X')
  return [...out.values()]
}

describe('perfectMove, exhaustively', () => {
  it('at every reachable position, whatever the tie-break draws, the move has the true best value', () => {
    const positions = oToMovePositions()
    expect(positions.length).toBeGreaterThan(1000)
    // Constant draws sweep the tie-break across every index; seeded runs add ordinary randomness.
    const draws: (() => number)[] = []
    for (let i = 0; i < 20; i++) draws.push(() => i / 20)
    draws.push(() => 0.999999999)
    for (let seed = 1; seed <= 12; seed++) draws.push(seeded(seed))
    let wins = 0
    for (const cells of positions) {
      const values = new Map<number, number>()
      for (const m of legalMoves(cells)) {
        const next = cells.slice()
        next[m] = 'O'
        values.set(m, slowValue(next, 'X'))
      }
      const best = Math.max(...values.values())
      if (best === 1) wins++
      for (const rng of draws) {
        const m = perfectMove(cells, rng)
        expect(values.get(m), `board ${cells.map((c) => c ?? '.').join('')}, move ${m}`).toBe(best)
      }
    }
    // The sweep did cover positions where a win was on offer, the case a loose tie-break gets wrong.
    expect(wins).toBeGreaterThan(100)
  })
})
