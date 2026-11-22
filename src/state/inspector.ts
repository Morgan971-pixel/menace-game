// The box inspector: which cabinet slot is selected or hovered, and what a box looks like.
// boxView reads the brain through inspect(), so the numbers shown are the engine's own.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Cell } from '../engine/board'
import { inspect, moveNumber, type Menace } from '../engine/menace'
import { keyAtSlot } from '../engine/slots'
import { COLS } from '../scene/geometry'
import { percentShares } from './shares'

export interface SquareView {
  /** Real square, 0 = top-left. */
  square: number
  count: number
  /** Whole percent of the box; the shares of one box add up to exactly 100 (0 each for an empty box). */
  share: number
}

export interface BoxView {
  slot: number
  /** Box number as shown: slot + 1. */
  number: number
  key: string
  /** The box's position, as 9 cells. */
  cells: Cell[]
  /** MENACE's move number for this box, 1 to 4. */
  move: number
  /** One entry per empty square, in square order. */
  squares: SquareView[]
  total: number
  /** What the box held before any learning. */
  started: number
}

export function keyCells(key: string): Cell[] {
  return [...key].map((c) => (c === 'X' ? 'X' : c === 'O' ? 'O' : null))
}

/** The box in cabinet slot `slot`, or null when the slot is empty (no such box, or not made yet). */
export function boxView(m: Menace, slot: number): BoxView | null {
  const key = keyAtSlot(m, slot)
  if (key === undefined) return null
  const cells = keyCells(key)
  const { beads } = inspect(m, cells)
  const empty = cells.flatMap((c, i) => (c === null ? [i] : []))
  const counts = empty.map((i) => beads[i] ?? 0)
  const shares = percentShares(counts)
  const move = moveNumber(cells)
  return {
    slot,
    number: slot + 1,
    key,
    cells,
    move,
    squares: empty.map((square, k) => ({ square, count: counts[k], share: shares[k] })),
    total: counts.reduce((a, b) => a + b, 0),
    // The engine rules start every box on the first stage's beads.
    started: (m.config.startBeads[m.config.rules === 'engine' ? 0 : move - 1] ?? 0) * empty.length,
  }
}

/** The share as shown: whole percent, or "<1%" when beads exist but the rounded share is 0. */
export function shareLabel(count: number, share: number): string {
  return count > 0 && share === 0 ? '<1%' : `${share}%`
}

export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'
export const NAV_KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']

/**
 * Next slot for a navigation key: left/right by 1, up/down by one cabinet row, Home/End to the
 * ends. Stays inside the cabinet. `has` says which slots hold a box (engine rules leave some
 * empty); a step skips empty slots in its own direction and stays put when none is left.
 */
export function stepSlot(
  slot: number,
  key: NavKey,
  count: number,
  cols: number = COLS,
  has: (slot: number) => boolean = () => true,
): number {
  const last = count - 1
  const by = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -cols : key === 'ArrowDown' ? cols : 0
  if (key === 'Home' || key === 'End') {
    const from = key === 'Home' ? 0 : last
    const dir = key === 'Home' ? 1 : -1
    for (let s = from; s >= 0 && s <= last; s += dir) if (has(s)) return s
    return slot
  }
  for (let next = slot + by; next >= 0 && next <= last; next += by) {
    if (has(next)) return next
  }
  return slot
}

/** Between games, or in the ledger once a box is on show. Never while a game is being played or training runs. */
export function canInspect(phase: string, training: boolean, ledgerShown: boolean): boolean {
  if (training) return false
  if (phase === 'title' || phase === 'over') return true
  return phase === 'ledger' && ledgerShown
}

/** Whether a click on the cabinet may pick a box: between games, nothing open over it. */
export function canPick(phase: string, training: boolean, blocked: boolean): boolean {
  return !blocked && canInspect(phase, training, false)
}

export interface InspectorState {
  /** Selected slot, or null when the inspector is closed. */
  slot: number | null
  hover: number | null
  open: (slot: number) => void
  close: () => void
  setHover: (slot: number | null) => void
}

export const inspector = createStore<InspectorState>()((set) => ({
  slot: null,
  hover: null,
  open: (slot) => set({ slot }),
  close: () => set({ slot: null }),
  setHover: (hover) => set((s) => (s.hover === hover ? s : { hover })),
}))

export function useInspector<T>(selector: (s: InspectorState) => T): T {
  return useStore(inspector, selector)
}
