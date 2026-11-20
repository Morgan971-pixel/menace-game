import { describe, expect, it } from 'vitest'
import {
  TRANSFORMS,
  canonicalize,
  legalMoves,
  permute,
  winner,
  type Cell,
} from './board'
import { fromString } from './testing'

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

describe('winner', () => {
  for (const who of ['X', 'O'] as const) {
    LINES.forEach((line, i) => {
      it(`detects ${who} on line ${i}`, () => {
        const cells: Cell[] = Array(9).fill(null)
        for (const k of line) cells[k] = who
        expect(winner(cells)).toBe(who)
      })
    })
  }

  it('detects a draw on a full board with no line', () => {
    expect(winner(fromString('XOXXOOOXX'))).toBe('D')
  })

  it('returns null while in progress', () => {
    expect(winner(fromString('XO       '))).toBeNull()
    expect(winner(fromString('         '))).toBeNull()
  })

  it('reports the winner when two lines are complete at once', () => {
    expect(winner(fromString('XXXXOOXOO'))).toBe('X')
  })

  it('prefers a win over a draw on a full board', () => {
    expect(winner(fromString('XXXOOXOXO'))).toBe('X')
  })
})

describe('legalMoves', () => {
  it('lists empty squares in order', () => {
    expect(legalMoves(fromString('X O  X   '))).toEqual([1, 3, 4, 6, 7, 8])
  })
})

describe('TRANSFORMS', () => {
  it('has exactly 8 entries', () => {
    expect(TRANSFORMS).toHaveLength(8)
  })

  it('every transform is a permutation of 0..8', () => {
    for (const t of TRANSFORMS) {
      expect([...t].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    }
  })

  it('is closed under composition', () => {
    const ids = new Set(TRANSFORMS.map((t) => t.join(',')))
    for (const a of TRANSFORMS) {
      for (const b of TRANSFORMS) {
        const composed = a.map((i) => b[i])
        expect(ids.has(composed.join(','))).toBe(true)
      }
    }
  })
})

describe('permute', () => {
  it('matches the Python docstring example', () => {
    expect(permute(fromString('X        '), [2, 5, 8, 1, 4, 7, 0, 3, 6])).toEqual(
      fromString('      X  '),
    )
  })
})

describe('canonicalize', () => {
  it('gives one key for all 8 symmetric images of a board', () => {
    const board = fromString('XO  X  O ')
    const keys = new Set(TRANSFORMS.map((t) => canonicalize(permute(board, t)).key))
    expect(keys.size).toBe(1)
  })

  it('returns a perm that reproduces the key', () => {
    const board = fromString('  XO  X  ')
    const { key, perm } = canonicalize(board)
    expect(permute(board, perm).map((c) => c ?? ' ').join('')).toBe(key)
  })

  it('uses a space for empty squares', () => {
    expect(canonicalize(fromString('         ')).key).toBe('         ')
  })
})

// Expected keys produced by running the Python engine's canonicalize
// (menace-tictactoe/menace/menace.py) once.
const PYTHON_FIXTURE: [string, string][] = [
  ["X XO OO X", "O XO OX X"],
  ["X XOXOO  ", "  OOXOX X"],
  ["XOX XOOXO", "O XXXOOOX"],
  [" O X     ", "     O X "],
  ["X    XO  ", "  OX    X"],
  ["OOX XXX O", "O XOX XXO"],
  ["  X  O   ", "       OX"],
  ["      X  ", "        X"],
  ["  X      ", "        X"],
  ["OOXX  O X", "O XX  OOX"],
  ["XOOXX XO ", "  OOXOXXX"],
  ["O   X    ", "    X   O"],
  ["   X  O  ", "       XO"],
  ["XOOOXXX O", "O XXXOOOX"],
  ["X     O  ", "      O X"],
  [" O  X   X", "    XOX  "],
  ["         ", "         "],
  [" O XXX O ", " O XXX O "],
  ["        X", "        X"],
  [" X      O", "     XO  "],
  ["   O X   ", "   O X   "],
  ["  XOX    ", "    XOX  "],
  [" O      X", "     OX  "],
  ["XXOOO XXO", "O OXOXXOX"],
  ["X   O O X", "  X O X O"],
  ["OXX O XO ", "  XOOXX O"],
  ["  O   X  ", "  O   X  "],
  ["   O    X", "     OX  "],
  ["OXX   OOX", "O OO XX X"],
  ["  OX  X  ", "  O   XX "],
  [" X  OX   ", "    OX X "],
  ["OXOX OOXX", "OOXX XOXO"],
  ["X  XOO X ", "  XOOX X "],
  ["  OXXX  O", "  OXXX  O"],
  ["OX XOOXX ", " O XOXOXX"],
  ["X O      ", "      O X"],
  ["   X     ", "       X "],
  [" XOXO OX ", "  OXOXOX "],
  [" O OXXX  ", "  XXXO O "],
  ["X OXO X  ", "  O O XXX"],
  [" X   X O ", "   O X X "],
  ["OX       ", "       XO"],
  ["O X  OX X", "O X   XOX"],
  ["       X ", "       X "],
  ["   X O   ", "   O X   "],
  ["XOOOXXOX ", " XOXXOOOX"],
  ["O OOXXOXX", "O OOXXOXX"],
  ["      OX ", "       XO"],
  ["XO  OXOXX", " OXXO XXO"],
  ["XX XXOOOO", " OOXXOXXO"],
  ["  X  XOO ", "  O  OXX "],
  [" X       ", "       X "],
  ["XO       ", "       OX"],
  [" O X XO  ", "  OX X O "],
  ["X XOOXXO ", " OXXOOX X"],
  ["XXOXO OXO", "O OXOXOXX"],
  [" XO   X  ", "  O  XX  "],
  [" OXXO    ", "    OXXO "],
  [" O OXXXXO", " O OXXXXO"],
  ["OOX OX XX", "  OXOOXXX"],
]

describe('cross-check with the Python canonicalize', () => {
  it('has at least 50 fixtures', () => {
    expect(PYTHON_FIXTURE.length).toBeGreaterThanOrEqual(50)
  })
  for (const [board, key] of PYTHON_FIXTURE) {
    it(`key for "${board}"`, () => {
      expect(canonicalize(fromString(board)).key).toBe(key)
    })
  }
})
