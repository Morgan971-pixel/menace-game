// Save, export and import for MENACE's brain and the player's record.
//
// Everything that touches storage goes through try/catch: a missing, full or throwing
// localStorage (private mode) never stops the game. A save that fails any check is thrown
// away with a console warning and the game starts fresh.
import { deserialize, serialize, type Menace } from '../engine/menace'
import { isSlotKey } from '../engine/slots'
import { configProblem } from './config'
import { emptyCurve, parseCurve, type Curve } from './curve'
import { parseDish, type Dish } from './dish'
import { saveFailedLine } from './lines'
import type { GameState, Record3, Speed } from './store'
import type { StoreApi } from 'zustand/vanilla'

export const SAVE_KEY = 'menace.save.v1'
export const SAVE_VERSION = 1
export const EXPORT_FORMAT = 'menace-brain'
export const EXPORT_VERSION = 1
export const EXPORT_FILENAME = 'menace-brain.json'

/** The slice of Storage this module uses, so tests can pass a fake. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** What survives a reload. */
export interface Saved {
  brain: Menace
  record: Record3
  /** The dish on the desk: confiscated beads per colour, plus the last few drawn. */
  dish: Dish
  speed: Speed
  /** MENACE's results over every game, the player's and training. Empty for a save from before the curve. */
  curve: Curve
  /** Games MENACE played in training (not against the player). */
  trained: number
  /** MENACE's current unbeaten run against the player. Absent in a save from before it: 0. */
  streak?: number
  /** True once "it has learned" fired for this brain. Absent in an older save: false. */
  learned?: boolean
  /** Best challenge results. Absent in an older save: none. */
  challengeBest?: ChallengeBest
}

/** Fewest games it took to win a challenge (null if never won) and the most games survived before a lockout. */
export interface ChallengeBest {
  won: number | null
  survived: number
}

export const noBest = (): ChallengeBest => ({ won: null, survived: 0 })

function parseBest(v: unknown): ChallengeBest {
  if (!isRecord(v)) return noBest()
  const won = v.won === null ? null : isCount(v.won) && v.won > 0 ? v.won : null
  return { won, survived: isCount(v.survived) ? v.survived : 0 }
}

const MAX_COUNT = 1_000_000_000
/** Largest file the import will read. */
export const MAX_FILE_BYTES = 5_000_000
/** Largest bead count a box may hold in a brain from outside. Real play stays far below it. */
// Guards against absurd values only: nothing allocates by bead count (the tray draws at most 90).
// Set high enough that heavy training (box 1 gains 3 beads per win) never rejects a real brain.
export const MAX_BEADS = 10_000_000
/** A count past this in a file from outside is nonsense and rejects the brain. Between MAX_BEADS and this, it is clamped. */
export const ABSURD_BEADS = 1e12

/** localStorage, or null when the browser denies even looking at it. */
export function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_COUNT
}

function parseRecord(v: unknown): Record3 {
  if (!isRecord(v) || !isCount(v.menace) || !isCount(v.draws) || !isCount(v.you)) {
    throw new Error('record must be three non-negative integers')
  }
  return { menace: v.menace, draws: v.draws, you: v.you }
}

function parseSpeed(v: unknown): Speed {
  if (v === 1 || v === 2 || v === 4) return v
  throw new Error('speed must be 1, 2 or 4')
}

/**
 * Vets a brain from outside (a save or an imported file) before the game touches it. The config
 * must sit inside the ranges Tinker offers (config.ts), every bead count stays under MAX_BEADS,
 * and every box must have a cabinet slot: a 1961 brain has exactly its 304 boxes (engine's
 * deserialize checks that) and an engine brain only boxes for real positions, so at most 338.
 * Nothing here sizes anything by a bead count or a reward.
 */
export function assertSupportedBrain(brain: Menace): void {
  const problem = configProblem(brain.config)
  if (problem !== null) throw new Error(`its settings are out of range: ${problem}`)
  if (brain.config.rules === 'engine') {
    for (const key of brain.boxes.keys()) {
      if (!isSlotKey(key)) throw new Error(`it has a box ("${key}") that is not a position MENACE can face.`)
    }
  }
  for (const beads of brain.boxes.values()) {
    if (beads.some((b) => !Number.isFinite(b) || b < 0 || b > ABSURD_BEADS)) throw new Error('a box holds an impossible number of beads.')
    for (let i = 0; i < beads.length; i++) if (beads[i] > MAX_BEADS) (beads as number[])[i] = MAX_BEADS
  }
}

/** Turns stored text into a Saved, or throws an Error saying what is wrong. */
export function parseSave(text: string): Saved {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('the save is not valid JSON')
  }
  if (!isRecord(data)) throw new Error('the save is not an object')
  if (data.version !== SAVE_VERSION) throw new Error(`unsupported save version ${String(data.version)}`)
  if (typeof data.brain !== 'string') throw new Error('the save has no brain')
  const brain = deserialize(data.brain)
  assertSupportedBrain(brain)
  return {
    brain,
    record: parseRecord(data.record),
    // The current shape is `dish`; saves from before it carried a plain `confiscated` list.
    dish: parseDish(data.dish !== undefined ? data.dish : data.confiscated),
    speed: parseSpeed(data.speed),
    streak: isCount(data.streak) ? data.streak : 0,
    learned: data.learned === true,
    challengeBest: parseBest(data.challengeBest),
    ...parseTraining(data),
  }
}

/**
 * The curve and the training count arrived after the first save format, so a save without them
 * still loads. A damaged curve is dropped with a warning; it is only a chart and never worth
 * losing the brain over.
 */
function parseTraining(data: Record<string, unknown>): { curve: Curve; trained: number } {
  let curve = parseCurve(data.curve)
  if (curve === null) {
    console.warn('MENACE: discarded a damaged learning curve, keeping the brain.')
    curve = emptyCurve()
  }
  const trained = data.trained === undefined ? 0 : isCount(data.trained) ? data.trained : 0
  return { curve, trained }
}

/** The saved state, or null when there is none or it cannot be trusted. Never throws. */
export function loadSave(storage: StorageLike | null = defaultStorage()): Saved | null {
  if (storage === null) return null
  let text: string | null
  try {
    text = storage.getItem(SAVE_KEY)
  } catch (err) {
    console.warn('MENACE: could not read the save, starting fresh.', err)
    return null
  }
  if (text === null) return null
  try {
    return parseSave(text)
  } catch (err) {
    console.warn('MENACE: discarded a corrupt save, starting fresh.', err)
    try {
      storage.removeItem(SAVE_KEY)
    } catch {
      // Nothing more to do: the next successful save overwrites it.
    }
    return null
  }
}

/** Writes the save. Returns false when storage refused (full, blocked, missing). Never throws. */
export function writeSave(saved: Saved, storage: StorageLike | null = defaultStorage()): boolean {
  if (storage === null) return false
  try {
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        brain: serialize(saved.brain),
        record: saved.record,
        dish: saved.dish,
        speed: saved.speed,
        curve: saved.curve,
        trained: saved.trained,
        streak: saved.streak ?? 0,
        learned: saved.learned === true,
        challengeBest: saved.challengeBest ?? noBest(),
        savedAt: new Date().toISOString(),
      }),
    )
    return true
  } catch (err) {
    console.warn('MENACE: could not save, playing on without it.', err)
    return false
  }
}

export function gamesPlayed(record: Record3): number {
  return record.menace + record.draws + record.you
}

/** The text of menace-brain.json: the engine's serialize output inside a small envelope. */
export function exportBrain(brain: Menace, record: Record3, now: Date = new Date()): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      gamesPlayed: gamesPlayed(record),
      brain: JSON.parse(serialize(brain)) as unknown,
    },
    null,
    1,
  )
}

/** Reads an exported file. Throws an Error whose message is fit to show the player. */
export function parseBrainFile(text: string): Menace {
  if (text.length > MAX_FILE_BYTES) throw new Error('That file is too big to be a MENACE brain.')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't a MENACE brain (it is not valid JSON).")
  }
  if (!isRecord(data) || data.format !== EXPORT_FORMAT) throw new Error("That file isn't a MENACE brain.")
  if (data.version !== EXPORT_VERSION) {
    throw new Error(`That brain file is version ${String(data.version)}; this machine reads version ${EXPORT_VERSION}.`)
  }
  if (!isRecord(data.brain)) throw new Error("That file isn't a MENACE brain (no brain inside).")
  let brain: Menace
  try {
    brain = deserialize(JSON.stringify(data.brain))
  } catch (err) {
    throw new Error(err instanceof Error ? `That brain is damaged: ${err.message}` : 'That brain is damaged.')
  }
  try {
    assertSupportedBrain(brain)
  } catch (err) {
    throw new Error(`That brain can't be loaded: ${err instanceof Error ? err.message : 'unsupported.'}`)
  }
  return brain
}

/** Removes the save. Returns false when storage refused. Never throws. */
export function clearSave(storage: StorageLike | null = defaultStorage()): boolean {
  if (storage === null) return false
  try {
    storage.removeItem(SAVE_KEY)
    return true
  } catch {
    return false
  }
}

/**
 * What gets written. During a challenge the top-level brain, record, dish and curve belong to the
 * challenge, so the save takes the MAIN ones from the stash instead: no code path can write the
 * challenge brain over the real one. Only the speed and the challenge best are live.
 */
export function savedFrom(s: GameState): Saved {
  const m = s.challenge?.stash ?? s
  return {
    brain: m.brain, record: m.record, dish: m.dish, speed: s.speed, curve: m.curve, trained: m.trained,
    streak: m.streak, learned: m.learned, challengeBest: s.challengeBest,
  }
}

/** Between games: the brain holds only whole games, so it is safe to write. */
const canSave = (s: GameState) => s.phase === 'title' || s.phase === 'ledger' || s.phase === 'over'

/**
 * Writes the save when the tab is hidden or closed (`pagehide`, or `visibilitychange` to hidden),
 * so closing the tab mid-run keeps the games played so far. Training plays whole games and learns
 * each one before the next starts, so the brain never holds half a game; a game in progress is
 * never written. Returns an unsubscribe.
 */
export function attachFlushOnLeave(
  store: StoreApi<GameState>,
  storage: StorageLike | null = defaultStorage(),
  win: EventTarget = window,
  doc: EventTarget & { visibilityState?: string } = document,
): () => void {
  const flush = () => {
    const s = store.getState()
    if (canSave(s)) writeSave(savedFrom(s), storage)
  }
  const onHide = () => {
    if (doc.visibilityState === 'hidden') flush()
  }
  win.addEventListener('pagehide', flush)
  doc.addEventListener('visibilitychange', onHide)
  return () => {
    win.removeEventListener('pagehide', flush)
    doc.removeEventListener('visibilitychange', onHide)
  }
}

/**
 * Saves when a game's result is in (the ledger opens: learn and the record are already
 * applied, the ledger is only the replay) and whenever, between games, something worth keeping
 * changes: a reset, an import, the speed. Never while a game is being played or while training runs, so a reload
 * cannot resume a half-played game. A failed write flips `saveOk` and says so once in the
 * speech slip. Returns an unsubscribe.
 */
export function attachPersistence(store: StoreApi<GameState>, storage: StorageLike | null = defaultStorage()): () => void {
  // Not while training runs: the brain changes every frame, and one save at the end is enough.
  const saving = (s: GameState) => s.training === null && canSave(s)
  let warned = false
  return store.subscribe((s, prev) => {
    if (!saving(s)) return
    const changed =
      !saving(prev) ||
      s.brain !== prev.brain ||
      s.record !== prev.record ||
      s.dish !== prev.dish ||
      s.speed !== prev.speed ||
      s.curve !== prev.curve ||
      s.trained !== prev.trained ||
      s.streak !== prev.streak ||
      s.learned !== prev.learned ||
      s.challengeBest !== prev.challengeBest ||
      s.challenge !== prev.challenge
    if (!changed) return
    const ok = writeSave(savedFrom(s), storage)
    if (ok === s.saveOk) return
    if (!ok && !warned) {
      warned = true
      store.setState({ saveOk: false, speech: saveFailedLine() })
    } else store.setState({ saveOk: ok })
  })
}
