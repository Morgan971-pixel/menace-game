// Which sounds a store change should make, and when. Pure: compares two snapshots of the
// game, so the rules and the scene never call the audio code and this can be tested alone.
// Delays follow the animation timelines in scene/timing.ts.
import type { Cell, Result } from '../engine/board'
import { LEDGER_TIMELINE, TURN_TIMELINE } from '../scene/timing'

export const SOUND_NAMES = [
  'slide', 'rattle', 'drop', 'add', 'confiscate', 'mark',
  'menaceWins', 'draw', 'youWin', 'click', 'room',
] as const
export type SoundName = (typeof SOUND_NAMES)[number]

export interface Cue {
  name: SoundName
  /** Seconds from now. */
  delay: number
}

/** The parts of GameState the cues read. */
export interface CueState {
  phase: string
  board: readonly Cell[]
  turn: { id: number; forced: boolean; landed: boolean } | null
  result: Result | null
  ledger: readonly { kind: 'reward' | 'resign'; delta: number }[]
  ledgerAt: number
  speed: number
  /** Training games run without sound; the cabinet shimmer is silent. */
  training: unknown
}

const marks = (b: readonly Cell[]) => b.reduce((n, c) => n + (c === null ? 0 : 1), 0)

export function cuesFor(prev: CueState, next: CueState): Cue[] {
  const out: Cue[] = []
  // A new MENACE turn: the box slides out, is shaken, and a bead drops.
  if (next.turn !== null && next.turn.id !== prev.turn?.id && !next.turn.forced) {
    out.push(
      { name: 'slide', delay: TURN_TIMELINE.out[0] },
      { name: 'rattle', delay: TURN_TIMELINE.shake[0] },
      { name: 'drop', delay: TURN_TIMELINE.bead[0] },
      { name: 'slide', delay: TURN_TIMELINE.back[0] },
    )
  }
  // A mark drawn on the paper: MENACE's X when it lands, the player's O when played.
  if (marks(next.board) > marks(prev.board) && next.phase !== 'title') out.push({ name: 'mark', delay: 0 })
  // The result, the moment the game ends.
  if (next.result !== null && prev.result === null) {
    out.push({ name: next.result === 'X' ? 'menaceWins' : next.result === 'O' ? 'youWin' : 'draw', delay: 0.15 })
  }
  // Each ledger box: out of the cabinet, then beads go in or one goes to the dish.
  if (next.phase === 'ledger' && next.ledgerAt !== prev.ledgerAt && next.ledgerAt >= 0) {
    const item = next.ledger[next.ledgerAt]
    if (item !== undefined) {
      const speed = next.speed > 0 ? next.speed : 1
      out.push({ name: 'slide', delay: 0 })
      if (item.delta > 0) out.push({ name: 'add', delay: LEDGER_TIMELINE.act / speed })
      else if (item.delta < 0) out.push({ name: 'confiscate', delay: LEDGER_TIMELINE.act / speed })
    }
  }
  return out
}
