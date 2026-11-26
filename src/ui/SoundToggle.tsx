// Sound on/off, next to the Machine button. Remembered across visits (audio/sound.ts).
import { useSyncExternalStore } from 'react'
import { sound } from '../audio/sound'

export function SoundToggle() {
  const muted = useSyncExternalStore(sound.subscribe, sound.muted)
  return (
    <button className="btn btn--small machine__sound" aria-pressed={!muted} onClick={() => sound.setMuted(!muted)}>
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  )
}
