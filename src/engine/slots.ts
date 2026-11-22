// Fixed cabinet slots for both rule sets.
//
// engine/menace.ts numbers boxes by their place in the sorted list of boxes that exist. In
// 'engine' rules boxes appear lazily, so that number would shift as each new box is made, and
// a slot saved in a ledger or a turn would point at the wrong box. Here every position MENACE
// can face on moves 1 to 5 has one permanent slot, whether or not its box exists yet.
//
// The first 304 slots (moves 1 to 4) are the same positions, in the same order, as boxKeys()
// gives a 1961 brain, so a 1961 cabinet is unchanged. Slots 304 to 337 are the move-5 positions
// that only the engine rules ever make a box for.
import { canonicalize, legalMoves, winner, type Cell } from './board'
import type { Menace } from './menace'

const stageOf = (key: string) => [...key].filter((c) => c === 'X').length
const compareKeys = (a: string, b: string) => stageOf(a) - stageOf(b) || (a < b ? -1 : a > b ? 1 : 0)

function buildKeys(): readonly string[] {
  const keys = new Set<string>()
  const walk = (cells: Cell[], turn: 'X' | 'O') => {
    if (winner(cells) !== null) return
    if (turn === 'X') keys.add(canonicalize(cells).key)
    for (const m of legalMoves(cells)) {
      const next = cells.slice()
      next[m] = turn
      walk(next, turn === 'X' ? 'O' : 'X')
    }
  }
  walk(Array<Cell>(9).fill(null), 'X')
  // X moves with at most 4 X's on the board, so move 5 is the last.
  return Object.freeze([...keys].sort(compareKeys))
}

/** Every position MENACE can face, ordered by move number then key: slot i holds ALL_KEYS[i]. */
export const ALL_KEYS: readonly string[] = buildKeys()
const SLOT_OF: ReadonlyMap<string, number> = new Map(ALL_KEYS.map((k, i) => [k, i]))

/** Slots in the cabinet for a rule set: 304 for 1961, 338 for the engine. */
export function slotCount(rules: '1961' | 'engine'): number {
  return rules === '1961' ? 304 : ALL_KEYS.length
}

/** True for a key that has a slot (a canonical, reachable MENACE position). */
export function isSlotKey(key: string): boolean {
  return SLOT_OF.has(key)
}

/** The permanent slot of a box key, or -1 when it has none. */
export function slotOfKey(key: string): number {
  return SLOT_OF.get(key) ?? -1
}

/** The key in a slot, only when that box exists in this brain. */
export function keyAtSlot(m: Menace, slot: number): string | undefined {
  const key = ALL_KEYS[slot]
  return key !== undefined && m.boxes.has(key) ? key : undefined
}

export function slotMade(m: Menace, slot: number): boolean {
  return keyAtSlot(m, slot) !== undefined
}

/** How many boxes exist right now. */
export function boxesMade(m: Menace): number {
  return m.boxes.size
}
