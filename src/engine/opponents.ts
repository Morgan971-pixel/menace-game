// The players MENACE can train against. Every opponent plays O, and MENACE always plays X first.
import { cellsToKey, legalMoves, winner, type Cells, type Result } from './board'
import type { Rng } from './rng'

export interface Opponent {
  readonly name: string
  /** The square (0 = top-left) O plays on this board. The board has at least one empty square. */
  move(cells: Cells, rng: Rng): number
  /**
   * Called once when a game ends, with the result from MENACE's side: 'X' MENACE won, 'O' it lost,
   * 'D' draw. Only opponents that learn (the mirror) implement it.
   */
  finish?(result: Result): void
}

/** Picks a legal square uniformly. */
export function randomMove(cells: Cells, rng: Rng): number {
  const moves = legalMoves(cells)
  if (moves.length === 0) throw new Error('randomMove: the board is full')
  return moves[Math.floor(rng() * moves.length) % moves.length]
}

// Minimax value of a position from O's side: 1 O wins, 0 draw, -1 X wins. Memoised on the board plus
// whose turn it is. At most a few thousand positions exist, so the table stays small.
const values = new Map<string, number>()

function valueFor(cells: Cells, turn: 'X' | 'O'): number {
  const end = winner(cells)
  if (end !== null) return end === 'O' ? 1 : end === 'X' ? -1 : 0
  const id = cellsToKey(cells) + turn
  const hit = values.get(id)
  if (hit !== undefined) return hit
  const next = turn === 'X' ? 'O' : 'X'
  let best = turn === 'O' ? -2 : 2
  for (const m of legalMoves(cells)) {
    const board = cells.slice()
    board[m] = turn
    const v = valueFor(board, next)
    best = turn === 'O' ? Math.max(best, v) : Math.min(best, v)
  }
  values.set(id, best)
  return best
}

/** A move of the best value for O. Ties between equally good moves go to the rng. */
export function perfectMove(cells: Cells, rng: Rng): number {
  const moves = legalMoves(cells)
  if (moves.length === 0) throw new Error('perfectMove: the board is full')
  let best = -2
  let top: number[] = []
  for (const m of moves) {
    const board = cells.slice()
    board[m] = 'O'
    const v = valueFor(board, 'X')
    if (v > best) {
      best = v
      top = [m]
    } else if (v === best) top.push(m)
  }
  return top[Math.floor(rng() * top.length) % top.length]
}

export const randomOpponent: Opponent = { name: 'Random', move: randomMove }
export const perfectOpponent: Opponent = { name: 'Perfect', move: perfectMove }
