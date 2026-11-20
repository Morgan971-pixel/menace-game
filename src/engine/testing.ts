// Test-only helpers shared by the engine specs.
import { legalMoves, winner, type Cell, type Cells } from './board'

export function fromString(s: string): Cell[] {
  return [...s].map((c) => (c === 'X' || c === 'O' ? c : null))
}

export function countOf(cells: Cells, who: Cell): number {
  return cells.filter((c) => c === who).length
}

/**
 * Every position reachable in legal play (X first, game stops at a result)
 * with X to move and the game not over. Deduplicated, no symmetry merging.
 */
export function xToMovePositions(): Cell[][] {
  const out = new Map<string, Cell[]>()
  const seen = new Set<string>()
  const walk = (cells: Cell[], turn: 'X' | 'O') => {
    const id = cells.map((c) => c ?? ' ').join('') + turn
    if (seen.has(id)) return
    seen.add(id)
    if (winner(cells) !== null) return
    if (turn === 'X') out.set(id, cells)
    for (const m of legalMoves(cells)) {
      const next = cells.slice()
      next[m] = turn
      walk(next, turn === 'X' ? 'O' : 'X')
    }
  }
  walk(Array<Cell>(9).fill(null), 'X')
  return [...out.values()]
}

type MutableBoxes = Map<string, number[]>
type BrainLike = { boxes: ReadonlyMap<string, readonly number[]> }

/** Test-only escape hatch: overwrite a box's beads on a brain whose boxes are read-only for consumers. */
export function setBeads(m: BrainLike, key: string, beads: readonly number[]): void {
  ;(m.boxes as MutableBoxes).set(key, [...beads])
}

/** Deep copy of every box, for before/after comparisons. */
export function snapshot(m: BrainLike): Map<string, number[]> {
  return new Map([...m.boxes].map(([k, v]) => [k, [...v]]))
}
