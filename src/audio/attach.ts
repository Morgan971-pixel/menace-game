// Wires the sound player to the page: the first gesture unlocks audio, button presses click,
// and store changes become cues. Returns a detach function.
import type { StoreApi } from 'zustand/vanilla'
import type { GameState } from '../state/store'
import { motionRate } from '../scene/motion'
import { cuesFor } from './cues'
import type { Sound } from './sound'

export function attachSound(store: StoreApi<GameState>, sound: Sound, doc: Document = document): () => void {
  const unlock = () => sound.unlock()
  // Capture phase, so the gesture that starts a game unlocks audio before its own sounds are cued.
  doc.addEventListener('pointerdown', unlock, true)
  doc.addEventListener('keydown', unlock, true)
  const onClick = (e: MouseEvent) => {
    const t = e.target
    if (t instanceof Element && t.closest('button:not(:disabled)')) sound.play('click')
  }
  doc.addEventListener('click', onClick, true)
  const unsub = store.subscribe((next, prev) => {
    // Training plays many games a frame: it stays silent.
    if (next.training !== null) return
    const rate = motionRate()
    for (const c of cuesFor(prev, next)) sound.play(c.name, c.delay / rate)
  })
  return () => {
    doc.removeEventListener('pointerdown', unlock, true)
    doc.removeEventListener('keydown', unlock, true)
    doc.removeEventListener('click', onClick, true)
    unsub()
  }
}
