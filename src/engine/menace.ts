// Port of menace.py (MENACE, Michie 1961) with two rule sets:
//   '1961'   - all 304 boxes built up front, beads confiscated down to 0, resigns on an empty box.
//   'engine' - the original Python behaviour: lazy boxes, flat start beads, floor of 1.
import { canonicalize, legalMoves, winner, type Cell, type Cells, type Result } from './board'
import type { Rng } from './rng'

export type RuleSet = '1961' | 'engine'

export interface MenaceConfig {
  readonly rules: RuleSet
  /** Beads per legal move on MENACE's 1st..4th move. */
  readonly startBeads: readonly [number, number, number, number]
  readonly rewards: { readonly win: number; readonly draw: number; readonly loss: number }
}

/**
 * boxes: canonical key -> bead count per CANONICAL square (0 for occupied squares).
 * Read-only for consumers; only chooseMove (engine lazy boxes) and learn mutate it.
 */
export interface Menace {
  readonly config: MenaceConfig
  readonly boxes: ReadonlyMap<string, readonly number[]>
}

export type HistoryEntry = { boxKey: string; canonMove: number }

export type Choice =
  | { kind: 'move'; square: number; entry: HistoryEntry | null; forced: boolean }
  /** The box is empty. The caller must end the game as a loss and call learn(history, 'O'). */
  | { kind: 'resign'; boxKey: string }

type MutableBoxes = Map<string, number[]>

export function defaultConfig(rules: RuleSet): MenaceConfig {
  return {
    rules,
    startBeads: rules === '1961' ? [4, 3, 2, 1] : [4, 4, 4, 4],
    rewards: { win: 3, draw: 1, loss: -1 },
  }
}

function copyConfig(c: MenaceConfig): MenaceConfig {
  const [a, b, d, e] = c.startBeads
  return { rules: c.rules, startBeads: [a, b, d, e], rewards: { ...c.rewards } }
}

/** MENACE's move number: it always plays X, so this is the count of X plus one. */
export function moveNumber(cells: Cells): number {
  return cells.filter((c) => c === 'X').length + 1
}

function stageOf(key: string): number {
  return [...key].filter((c) => c === 'X').length
}

function freshBox(key: string, beadsPerSquare: number): number[] {
  return [...key].map((c) => (c === ' ' ? beadsPerSquare : 0))
}

function startBeadsFor(config: MenaceConfig, key: string): number {
  if (config.rules === 'engine') return config.startBeads[0]
  const stage = stageOf(key) // 0..3 for MENACE's moves 1..4
  if (stage < 0 || stage > 3) throw new Error(`No start beads for a position with ${stage} X's`)
  return config.startBeads[stage]
}

/**
 * Every X-to-move, not-yet-over position on MENACE's moves 1 to 4, merged by symmetry,
 * ordered by move number then key. Independent of beads, so computed once.
 */
function build1961Keys(): readonly string[] {
  const keys = new Set<string>()
  const walk = (cells: Cell[], turn: 'X' | 'O') => {
    if (winner(cells) !== null) return
    if (turn === 'X') {
      if (moveNumber(cells) > 4) return
      keys.add(canonicalize(cells).key)
    }
    for (const m of legalMoves(cells)) {
      const next = cells.slice()
      next[m] = turn
      walk(next, turn === 'X' ? 'O' : 'X')
    }
  }
  walk(Array<Cell>(9).fill(null), 'X')
  return Object.freeze([...keys].sort(compareKeys))
}

function compareKeys(a: string, b: string): number {
  return stageOf(a) - stageOf(b) || (a < b ? -1 : a > b ? 1 : 0)
}

const KEYS_1961 = build1961Keys()
const KEY_SET_1961: ReadonlySet<string> = new Set(KEYS_1961)

interface KeyCache {
  size: number
  keys: readonly string[]
  index: ReadonlyMap<string, number>
}
// Keyed by brain. Valid while boxes.size is unchanged (boxes are only ever added).
const keyCaches = new WeakMap<Menace, KeyCache>()

function keyCache(m: Menace): KeyCache {
  const hit = keyCaches.get(m)
  if (hit !== undefined && hit.size === m.boxes.size) return hit
  const keys = m.config.rules === '1961' ? KEYS_1961 : Object.freeze([...m.boxes.keys()].sort(compareKeys))
  const fresh: KeyCache = { size: m.boxes.size, keys, index: new Map(keys.map((k, i) => [k, i])) }
  keyCaches.set(m, fresh)
  return fresh
}

export function createMenace(config: MenaceConfig = defaultConfig('1961')): Menace {
  const own = copyConfig(config)
  const boxes: MutableBoxes = new Map()
  if (own.rules === '1961') {
    for (const key of KEYS_1961) boxes.set(key, freshBox(key, startBeadsFor(own, key)))
  }
  return { config: own, boxes }
}

/** Stable order: by MENACE move number, then key. Gives each box a fixed cabinet slot. */
export function boxKeys(m: Menace): readonly string[] {
  return keyCache(m).keys
}

/** Position of the box in boxKeys(m), or -1 if there is no such box. */
export function boxIndex(m: Menace, key: string): number {
  return keyCache(m).index.get(key) ?? -1
}

export function beadsOf(m: Menace, key: string): readonly number[] {
  const box = m.boxes.get(key)
  if (box === undefined) throw new Error(`No matchbox for position "${key}"`)
  return box
}

/** True for the 1961 move-5 position, where one square is left and there is no box. */
function isForced(m: Menace, cells: Cells): boolean {
  return m.config.rules === '1961' && moveNumber(cells) === 5
}

function getOrCreateBox(m: Menace, key: string): readonly number[] {
  const box = m.boxes.get(key)
  if (box !== undefined) return box
  if (m.config.rules === '1961') throw new Error(`No matchbox for position "${key}"`)
  const created = freshBox(key, startBeadsFor(m.config, key))
  ;(m.boxes as MutableBoxes).set(key, created)
  return created
}

/**
 * Sample a move. In 'engine' rules a square holding 0 beads still weighs 1 (max(1, count)).
 * Throws if the game is already over.
 */
export function chooseMove(m: Menace, cells: Cells, rng: Rng): Choice {
  if (winner(cells) !== null) throw new Error('chooseMove: the game is already over')
  if (isForced(m, cells)) {
    const moves = legalMoves(cells)
    if (moves.length !== 1) throw new Error('Expected exactly one empty square on move 5')
    return { kind: 'move', square: moves[0], entry: null, forced: true }
  }
  const { key, perm } = canonicalize(cells)
  const box = getOrCreateBox(m, key)
  const engine = m.config.rules === 'engine'
  const weights = box.map((count, i) =>
    key[i] === ' ' ? (engine ? Math.max(1, count) : count) : 0,
  )
  const total = weights.reduce((a, b) => a + b, 0)
  if (total === 0) return { kind: 'resign', boxKey: key }

  let r = rng() * total
  let canonMove = weights.findIndex((w) => w > 0)
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] === 0) continue
    canonMove = i
    if (r < weights[i]) break
    r -= weights[i]
  }
  // Floating-point note: rng() < 1 keeps r < total, but repeated subtraction can leave r
  // marginally >= the last weight. The loop then falls through with canonMove set to the
  // last weighted square, which is the correct pick.
  // Canonical square k came from real square perm[k] (permute builds b[k] = board[perm[k]]).
  // Map back with perm, not its inverse: the inverse is wrong for the 90 and 270 degree rotations.
  const square = perm[canonMove]
  return { kind: 'move', square, entry: { boxKey: key, canonMove }, forced: false }
}

/**
 * result is from MENACE's side: 'X' = MENACE won, 'O' = it lost, 'D' = draw.
 * In 1961 rules a missing box can only be a bug, so it throws; engine rules skip it.
 */
export function learn(m: Menace, history: readonly HistoryEntry[], result: Result): void {
  const { win, draw, loss } = m.config.rewards
  const delta = result === 'X' ? win : result === 'D' ? draw : loss
  const floor = m.config.rules === '1961' ? 0 : 1
  for (const { boxKey, canonMove } of history) {
    const box = m.boxes.get(boxKey) as number[] | undefined
    if (box === undefined) {
      if (m.config.rules === '1961') throw new Error(`learn: no matchbox for history entry "${boxKey}"`)
      continue
    }
    box[canonMove] = Math.max(floor, box[canonMove] + delta)
  }
}

export function inspect(
  m: Menace,
  cells: Cells,
): { boxKey: string | null; beads: (number | null)[] } {
  const beads: (number | null)[] = Array<number | null>(9).fill(null)
  if (isForced(m, cells)) return { boxKey: null, beads }
  const { key, perm } = canonicalize(cells)
  // Engine boxes are lazy: show the starting beads without creating the box.
  const box =
    m.boxes.get(key) ??
    (m.config.rules === 'engine' ? freshBox(key, startBeadsFor(m.config, key)) : undefined)
  if (box === undefined) throw new Error(`No matchbox for position "${key}"`)
  box.forEach((count, k) => {
    // Same perm mapping as chooseMove.
    if (key[k] === ' ') beads[perm[k]] = count
  })
  return { boxKey: key, beads }
}

export function serialize(m: Menace): string {
  return JSON.stringify({
    version: 1,
    config: m.config,
    boxes: Object.fromEntries(m.boxes),
  })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}

/** Returns a copy of the beads, or null when v is not 9 non-negative integers. */
function toBeads(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== 9 || !v.every(isCount)) return null
  return [...v]
}

function parseConfig(raw: unknown): MenaceConfig {
  if (!isRecord(raw)) throw new Error('Saved brain has no config object')
  const { rules, startBeads: sb, rewards: rw } = raw
  if (rules !== '1961' && rules !== 'engine') {
    throw new Error(`Unknown rules "${String(rules)}" (expected "1961" or "engine")`)
  }
  if (!Array.isArray(sb) || sb.length !== 4 || !sb.every(isCount)) {
    throw new Error('config.startBeads must be 4 non-negative integers')
  }
  if (!isRecord(rw) || !isInt(rw.win) || !isInt(rw.draw) || !isInt(rw.loss)) {
    throw new Error('config.rewards must have integer win, draw and loss')
  }
  return {
    rules,
    startBeads: [sb[0], sb[1], sb[2], sb[3]],
    rewards: { win: rw.win, draw: rw.draw, loss: rw.loss },
  }
}

export function deserialize(json: string): Menace {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON: could not parse the saved MENACE brain')
  }
  if (!isRecord(data)) throw new Error('Saved brain must be a JSON object')
  if (data.version !== 1) throw new Error(`Unsupported brain version: ${String(data.version)} (expected 1)`)
  const config = parseConfig(data.config)

  if (!isRecord(data.boxes)) throw new Error('Saved brain has no boxes object')
  const boxes: MutableBoxes = new Map()
  for (const [key, raw] of Object.entries(data.boxes)) {
    if (key.length !== 9 || ![...key].every((c) => c === 'X' || c === 'O' || c === ' ')) {
      throw new Error(`Bad box key "${key}": must be 9 characters of X, O or space`)
    }
    const beads = toBeads(raw)
    if (beads === null) throw new Error(`Bad beads for box "${key}": need 9 non-negative integers`)
    if (beads.some((b, i) => b !== 0 && key[i] !== ' ')) {
      throw new Error(`Bad beads for box "${key}": beads on an occupied square`)
    }
    boxes.set(key, beads)
  }
  if (config.rules === '1961') {
    const ok = boxes.size === KEY_SET_1961.size && [...boxes.keys()].every((k) => KEY_SET_1961.has(k))
    if (!ok) {
      throw new Error(
        `A 1961 brain needs exactly the ${KEY_SET_1961.size} canonical boxes, found ${boxes.size} with a different key set`,
      )
    }
  }
  return { config, boxes }
}
