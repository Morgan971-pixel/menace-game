// Whether the inspector is really showing a box. The open slot is only a number; a wipe, an
// import or a smaller engine brain can leave it pointing at a slot with no box. Everything that
// hides or shifts for the inspector (title, speech slip, game-over focus) asks this, so a stale
// slot can never leave the screen in a state with nothing to see and nothing to press.
import type { Menace } from '../engine/menace'
import { slotMade } from '../engine/slots'
import { useInspector } from './inspector'
import { useGame } from './store'

export function isInspecting(brain: Menace, slot: number | null): boolean {
  return slot !== null && slotMade(brain, slot)
}

export function useInspecting(): boolean {
  const slot = useInspector((s) => s.slot)
  // The brain is read through the box count: boxes are made in place, so its reference alone does not change.
  const brain = useGame((s) => s.brain)
  const made = useGame((s) => s.brain.boxes.size)
  void made
  return isInspecting(brain, slot)
}
