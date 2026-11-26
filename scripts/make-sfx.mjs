// One-off: generates the sound effects with ElevenLabs into public/sfx/, plus manifest.json.
// The game never calls ElevenLabs; it plays these files, or Web Audio placeholders without them.
// Usage: ELEVENLABS_API_KEY in .env (or the environment), then `node scripts/make-sfx.mjs [name ...]`.
// Existing files are kept unless named on the command line.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOUNDS = {
  slide: ['A small cardboard matchbox drawer sliding out of a wooden cabinet, dry paper friction, close mic', 0.8],
  rattle: ['A few small glass beads shaken inside a cardboard matchbox, short dry rattle', 0.8],
  drop: ['A single small glass bead dropping onto a paper desk, one soft click and a tiny bounce', 0.5],
  add: ['Three small glass beads dropped one after another into a cardboard matchbox', 0.7],
  confiscate: ['A single glass bead dropped into a small tin dish, a short metallic clink', 0.6],
  mark: ['A pencil drawing a quick short stroke on paper, close mic', 0.5],
  menaceWins: ['A short low muted brass sting, slightly smug, vintage 1960s radio', 1.2],
  draw: ['A short neutral two-note woodblock sting, vintage', 1.0],
  youWin: ['A short bright rising three-note vibraphone flourish, vintage', 1.2],
  click: ['A soft click of a mechanical typewriter key', 0.5],
  room: ['Quiet study room tone at night, faint distant hum, no voices, seamless loop', 8],
}

function key() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY
  if (existsSync('.env')) {
    const m = readFileSync('.env', 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  throw new Error('No ELEVENLABS_API_KEY in the environment or .env')
}

const out = 'public/sfx'
mkdirSync(out, { recursive: true })
const only = process.argv.slice(2)
const apiKey = key()
for (const [name, [text, seconds]] of Object.entries(SOUNDS)) {
  const file = join(out, `${name}.mp3`)
  if (only.length > 0 ? !only.includes(name) : existsSync(file)) continue
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.6 }),
  })
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`)
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  console.log(`wrote ${file}`)
}
const made = Object.keys(SOUNDS).filter((n) => existsSync(join(out, `${n}.mp3`)))
writeFileSync(join(out, 'manifest.json'), JSON.stringify(made, null, 2) + '\n')
console.log(`manifest: ${made.length} sounds`)
