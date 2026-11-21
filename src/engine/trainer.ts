// Headless training: MENACE (X, moves first) against an opponent (O). A port of train.py.
import { winner, type Cell, type Result } from './board'
import { chooseMove, learn, type HistoryEntry, type Menace } from './menace'
import type { Opponent } from './opponents'
import type { Rng } from './rng'

export interface GameRecord {
  /** From MENACE's side: 'X' it won, 'O' it lost (a resign counts), 'D' draw. */
  result: Result
  resigned: boolean
  history: HistoryEntry[]
}

/** Plays one full game and applies learn() to MENACE exactly once. The opponent learns once too, if it can. */
export function playGame(menace: Menace, opponent: Opponent, rng: Rng): GameRecord {
  const cells: Cell[] = Array<Cell>(9).fill(null)
  const history: HistoryEntry[] = []
  let result: Result | null = null
  let resigned = false
  while (result === null) {
    const choice = chooseMove(menace, cells, rng)
    if (choice.kind === 'resign') {
      result = 'O'
      resigned = true
      break
    }
    if (choice.entry) history.push(choice.entry)
    cells[choice.square] = 'X'
    result = winner(cells)
    if (result !== null) break
    cells[opponent.move(cells, rng)] = 'O'
    result = winner(cells)
  }
  learn(menace, history, result)
  opponent.finish?.(result)
  return { result, resigned, history }
}

export interface TrainSummary {
  games: number
  won: number
  drawn: number
  lost: number
}

/**
 * Plays n games. onGame sees each finished game; returning false stops the run early.
 * The summary counts the games actually played.
 */
export function train(
  menace: Menace,
  n: number,
  opponent: Opponent,
  rng: Rng,
  onGame?: (game: GameRecord, index: number) => boolean | void,
): TrainSummary {
  const sum: TrainSummary = { games: 0, won: 0, drawn: 0, lost: 0 }
  for (let i = 0; i < n; i++) {
    const g = playGame(menace, opponent, rng)
    sum.games++
    if (g.result === 'X') sum.won++
    else if (g.result === 'D') sum.drawn++
    else sum.lost++
    if (onGame?.(g, i) === false) break
  }
  return sum
}
