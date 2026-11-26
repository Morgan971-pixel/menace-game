// Web Audio placeholders for every sound, made from oscillators and filtered noise.
// Used until the ElevenLabs files exist in public/sfx/ (scripts/make-sfx.mjs).
import type { SoundName } from './cues'

function noise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/** A burst of filtered noise with a quick attack and an exponential tail. */
function hiss(ctx: AudioContext, out: AudioNode, at: number, len: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx, len)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  src.connect(f).connect(g).connect(out)
  src.start(at)
  src.stop(at + len + 0.02)
}

function tone(ctx: AudioContext, out: AudioNode, at: number, freq: number, len: number, gain: number, type: OscillatorType = 'sine', glideTo?: number): void {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (glideTo !== undefined) o.frequency.exponentialRampToValueAtTime(glideTo, at + len)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + len + 0.02)
}

/** A glass bead clicking on cardboard or tin. */
const tick = (ctx: AudioContext, out: AudioNode, at: number, pitch: number, gain = 0.25) => {
  tone(ctx, out, at, pitch, 0.06, gain, 'triangle', pitch * 0.8)
  hiss(ctx, out, at, 0.03, pitch * 1.5, 4, gain * 0.6)
}

/** Schedules one placeholder sound at ctx time `at`. 'room' is handled by roomTone(). */
export function synth(ctx: AudioContext, out: AudioNode, name: SoundName, at: number): void {
  switch (name) {
    case 'slide':
      hiss(ctx, out, at, 0.45, 900, 0.7, 0.22)
      break
    case 'rattle':
      for (let i = 0; i < 9; i++) tick(ctx, out, at + i * 0.065 + Math.random() * 0.02, 2400 + Math.random() * 1600, 0.12)
      break
    case 'drop':
      tick(ctx, out, at, 3200, 0.3)
      tick(ctx, out, at + 0.12, 2900, 0.15)
      break
    case 'add':
      for (let i = 0; i < 3; i++) tick(ctx, out, at + i * 0.08, 2600 + i * 300, 0.2)
      break
    case 'confiscate':
      // A bead into the tin dish: a duller, ringing clink.
      tone(ctx, out, at, 1850, 0.5, 0.18, 'sine', 1800)
      tick(ctx, out, at, 1400, 0.22)
      break
    case 'mark':
      hiss(ctx, out, at, 0.22, 3500, 1.2, 0.12, 'highpass')
      break
    case 'menaceWins':
      tone(ctx, out, at, 196, 0.5, 0.2, 'triangle')
      tone(ctx, out, at + 0.18, 147, 0.8, 0.2, 'triangle')
      break
    case 'draw':
      tone(ctx, out, at, 330, 0.5, 0.16, 'sine')
      tone(ctx, out, at + 0.2, 330, 0.6, 0.12, 'sine')
      break
    case 'youWin':
      tone(ctx, out, at, 392, 0.35, 0.18, 'triangle')
      tone(ctx, out, at + 0.14, 494, 0.35, 0.18, 'triangle')
      tone(ctx, out, at + 0.28, 587, 0.7, 0.18, 'triangle')
      break
    case 'click':
      tone(ctx, out, at, 1200, 0.04, 0.12, 'square', 600)
      break
    case 'room':
      break
  }
}

/** Quiet low room hum and air, looped. Returns a stop function. */
export function roomTone(ctx: AudioContext, out: AudioNode): () => void {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx, 4)
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 320
  const g = ctx.createGain()
  g.gain.value = 0.0001
  g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 2)
  src.connect(f).connect(g).connect(out)
  src.start()
  return () => {
    g.gain.cancelScheduledValues(ctx.currentTime)
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2)
    src.stop(ctx.currentTime + 1)
  }
}
