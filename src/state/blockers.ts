// "Something is open over the cabinet": the Train, Curve, How and Machine panels each switch the
// cabinet off for picking while they are up. A menu that closes on pointerdown (Machine) must
// keep blocking until the same click has finished, or that click would also pick a box.
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** Waits this long after pointerup, so the click event that follows it is over. */
const RELEASE_MS = 40

export function createBlockers(target: EventTarget) {
  const store = createStore<{ blocked: boolean }>()(() => ({ blocked: false }))
  const on = new Set<string>()
  const pending = new Set<string>()
  let down = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const publish = () => store.setState({ blocked: on.size > 0 || pending.size > 0 })
  const settle = () => {
    pending.clear()
    publish()
  }
  const onDown = () => {
    down = true
  }
  const onUp = () => {
    down = false
    if (pending.size === 0) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(settle, RELEASE_MS)
  }
  target.addEventListener('pointerdown', onDown, true)
  target.addEventListener('pointerup', onUp, true)
  target.addEventListener('pointercancel', onUp, true)

  return {
    store,
    /** Switches one named source on or off. */
    set(name: string, value: boolean) {
      if (value) {
        on.add(name)
        pending.delete(name)
      } else if (on.delete(name) && down) pending.add(name)
      publish()
    },
  }
}

export const blockers = createBlockers(typeof document === 'undefined' ? new EventTarget() : document)

export function useBlocked(): boolean {
  return useStore(blockers.store, (s) => s.blocked)
}
