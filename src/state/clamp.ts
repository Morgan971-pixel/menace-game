// learn() has no ceiling, and a save or import above MAX_BEADS used to be thrown away whole.
// After each game the state layer clamps the counts the game touched.
import type { HistoryEntry, Menace } from '../engine/menace'
import { MAX_BEADS } from './persist'

/** Caps the bead count of every box in `history` at MAX_BEADS. Only those boxes can have grown. */
export function clampHistory(brain: Menace, history: readonly HistoryEntry[]): void {
  for (const { boxKey, canonMove } of history) {
    const box = brain.boxes.get(boxKey) as number[] | undefined
    if (box !== undefined && box[canonMove] > MAX_BEADS) box[canonMove] = MAX_BEADS
  }
}
