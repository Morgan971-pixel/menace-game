// Port of game.py (winner, available_moves) and the symmetry helpers from menace.py.

/** Index 0 is the top-left square, counting row by row. */
export type Cell = 'X' | 'O' | null
export type Cells = readonly Cell[]
/** 'D' is a draw. */
export type Result = 'X' | 'O' | 'D'

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
]

export function winner(cells: Cells): Result | null {
  for (const [a, b, c] of LINES) {
    const v = cells[a]
    if (v !== null && v === cells[b] && v === cells[c]) return v
  }
  if (!cells.includes(null)) return 'D'
  return null
}

export function legalMoves(cells: Cells): number[] {
  const out: number[] = []
  cells.forEach((c, i) => {
    if (c === null) out.push(i)
  })
  return out
}

// Same 8 arrays, same order, as TRANSFORMS in menace.py.
export const TRANSFORMS: readonly (readonly number[])[] = Object.freeze(
  [
    [0, 1, 2, 3, 4, 5, 6, 7, 8], // identity
    [6, 3, 0, 7, 4, 1, 8, 5, 2], // rotate 90 clockwise
    [8, 7, 6, 5, 4, 3, 2, 1, 0], // rotate 180
    [2, 5, 8, 1, 4, 7, 0, 3, 6], // rotate 270 clockwise
    [2, 1, 0, 5, 4, 3, 8, 7, 6], // reflect horizontally
    [6, 7, 8, 3, 4, 5, 0, 1, 2], // reflect vertically
    [0, 3, 6, 1, 4, 7, 2, 5, 8], // reflect main diagonal
    [8, 5, 2, 7, 4, 1, 6, 3, 0], // reflect anti-diagonal
  ].map((t) => Object.freeze(t)),
)

/** Result[k] = cells[perm[k]], so canonical square k came from real square perm[k]. */
export function permute(cells: Cells, perm: readonly number[]): Cell[] {
  return perm.map((i) => cells[i])
}

export function cellsToKey(cells: Cells): string {
  return cells.map((c) => c ?? ' ').join('')
}

/**
 * Lexicographically smallest string over the 8 symmetric images (' ' < 'O' < 'X').
 * Ties go to the first transform in TRANSFORMS order, as Python's min does.
 */
export function canonicalize(cells: Cells): { key: string; perm: number[] } {
  let bestKey = ''
  let bestPerm: readonly number[] = TRANSFORMS[0]
  TRANSFORMS.forEach((perm, i) => {
    const key = cellsToKey(permute(cells, perm))
    if (i === 0 || key < bestKey) {
      bestKey = key
      bestPerm = perm
    }
  })
  return { key: bestKey, perm: [...bestPerm] }
}
