// The one sound player. Silent until the first user gesture (browsers block audio before one),
// then plays generated files from public/sfx/ when they exist and Web Audio placeholders otherwise.
// Mute is remembered in localStorage. Nothing here calls ElevenLabs.
import { SOUND_NAMES, type SoundName } from './cues'
import { roomTone, synth } from './synth'

export const MUTE_KEY = 'menace:muted'

export interface SoundDeps {
  /** Made on the first gesture only. */
  makeContext: () => AudioContext
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  /** Names with a generated file, and how to fetch one. Missing or failing: placeholders. */
  loadManifest: () => Promise<readonly string[]>
  loadFile: (name: SoundName) => Promise<ArrayBuffer>
}

export interface Sound {
  /** Call from a user gesture. Creates the audio context the first time; later calls do nothing. */
  unlock: () => void
  readonly unlocked: boolean
  muted: () => boolean
  setMuted: (m: boolean) => void
  /** Plays `name` after `delay` seconds. Dropped while locked or muted. */
  play: (name: SoundName, delay?: number) => void
  subscribe: (fn: () => void) => () => void
}

function readMuted(storage: SoundDeps['storage']): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function createSound(deps: SoundDeps): Sound {
  let ctx: AudioContext | null = null
  let out: GainNode | null = null
  let muted = readMuted(deps.storage)
  let stopRoom: (() => void) | null = null
  const files = new Map<SoundName, AudioBuffer>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((fn) => fn())

  /** The generated room file looped, or the synthesized hum. */
  const loopRoom = (c: AudioContext, o: AudioNode): (() => void) => {
    const file = files.get('room')
    if (file === undefined) return roomTone(c, o)
    const src = c.createBufferSource()
    src.buffer = file
    src.loop = true
    const g = c.createGain()
    g.gain.value = 0.5
    src.connect(g).connect(o)
    src.start()
    return () => src.stop()
  }

  const syncRoom = () => {
    if (ctx === null || out === null) return
    if (!muted && stopRoom === null) stopRoom = loopRoom(ctx, out)
    else if (muted && stopRoom !== null) {
      stopRoom()
      stopRoom = null
    }
  }

  const loadFiles = async (c: AudioContext) => {
    try {
      const names = await deps.loadManifest()
      await Promise.all(
        SOUND_NAMES.filter((n) => names.includes(n)).map(async (n) => {
          files.set(n, await c.decodeAudioData(await deps.loadFile(n)))
        }),
      )
      // Swap the hum for the generated room tone if it arrived.
      if (files.has('room') && stopRoom !== null) {
        stopRoom()
        stopRoom = null
        syncRoom()
      }
    } catch {
      // No generated files yet, or one failed: the placeholders cover every sound.
    }
  }

  return {
    unlock: () => {
      if (ctx !== null) return
      ctx = deps.makeContext()
      out = ctx.createGain()
      out.gain.value = 0.8
      out.connect(ctx.destination)
      void ctx.resume?.()
      void loadFiles(ctx)
      syncRoom()
      emit()
    },
    get unlocked() {
      return ctx !== null
    },
    muted: () => muted,
    setMuted: (m) => {
      muted = m
      try {
        deps.storage?.setItem(MUTE_KEY, m ? '1' : '0')
      } catch {
        // Storage blocked: mute still works for this visit.
      }
      syncRoom()
      emit()
    },
    play: (name, delay = 0) => {
      if (ctx === null || out === null || muted) return
      const at = ctx.currentTime + Math.max(0, delay)
      const file = files.get(name)
      if (file !== undefined) {
        const src = ctx.createBufferSource()
        src.buffer = file
        src.connect(out)
        src.start(at)
      } else synth(ctx, out, name, at)
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

const storage = (() => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
})()

/** The app's one sound player. */
export const sound = createSound({
  makeContext: () => new AudioContext(),
  storage,
  loadManifest: async () => {
    const r = await fetch(`${import.meta.env.BASE_URL}sfx/manifest.json`)
    if (!r.ok) return []
    const v: unknown = await r.json()
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  },
  loadFile: async (name) => {
    const r = await fetch(`${import.meta.env.BASE_URL}sfx/${name}.mp3`)
    if (!r.ok) throw new Error(`sfx ${name}: ${r.status}`)
    return r.arrayBuffer()
  },
})
