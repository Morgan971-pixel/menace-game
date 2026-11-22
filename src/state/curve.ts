// The learning curve's data: MENACE's results over every game it has played (the player's and
// training), kept as compact buckets so a million games still fit in a save.
//
// A bucket holds `per` games as [wins, draws, losses] from MENACE's side. `tail` is the newest,
// unfinished bucket (fewer than `per` games). When the buckets pass MAX_BUCKETS, neighbouring
// pairs merge and `per` doubles, so the old history gets coarser and the total never changes.
//
// The chart, its end labels and the text summary all read from one place, curveView(): at most
// MAX_BINS bins of whole buckets, each holding the exact counts of the games it covers.
import type { Result } from '../engine/board'

export const BUCKET_GAMES = 10
export const MAX_BUCKETS = 2000
/** Most bins the chart draws. */
export const MAX_BINS = 120
/** Fewest games a bin spans in a long history, so it does not draw as noise. */
export const MIN_BIN_GAMES = 40
/** Most runs kept in the curve. */
export const MAX_RUNS = 50
/** Largest bucket size accepted from a save: far past anything real play reaches. */
const MAX_PER = BUCKET_GAMES * 2 ** 30

type Counts = [number, number, number]

/** Who MENACE was playing: a training opponent, or the person at the keyboard. */
export type RunOpponent = 'random' | 'perfect' | 'itself' | 'player' | 'tinker' | 'learned'
const RUN_OPPONENTS: readonly RunOpponent[] = ['random', 'perfect', 'itself', 'player', 'tinker', 'learned']
export const RUN_NAMES: Record<RunOpponent, string> = { random: 'Random', perfect: 'Perfect', itself: 'Itself', player: 'you', tinker: 'new rewards', learned: 'it learned you' }

/** A change of opponent: games numbered after `start` (0 = the very first game) belong to this run. */
export interface Run {
  start: number
  opponent: RunOpponent
}

export interface Curve {
  /** Games per full bucket: BUCKET_GAMES times a power of two. */
  per: number
  /** Full buckets, oldest first, each [wins, draws, losses] adding to `per`. */
  buckets: Counts[]
  /** The newest games, fewer than `per`. */
  tail: Counts
  /** Where the opponent changed, oldest first, at most MAX_RUNS. */
  runs: Run[]
}

export const emptyCurve = (): Curve => ({ per: BUCKET_GAMES, buckets: [], tail: [0, 0, 0], runs: [] })

const sum = (c: readonly number[]) => c[0] + c[1] + c[2]

export function curveTotal(c: Curve): number {
  return c.buckets.length * c.per + sum(c.tail)
}

/** Merges pairs of buckets and doubles `per`. A lone last bucket folds into the tail. */
function coarsen(per: number, buckets: Counts[], tail: Counts): { per: number; buckets: Counts[]; tail: Counts } {
  const merged: Counts[] = []
  for (let i = 0; i + 1 < buckets.length; i += 2) {
    const a = buckets[i]
    const b = buckets[i + 1]
    merged.push([a[0] + b[0], a[1] + b[1], a[2] + b[2]])
  }
  let nextTail = tail
  if (buckets.length % 2 === 1) {
    const l = buckets[buckets.length - 1]
    nextTail = [tail[0] + l[0], tail[1] + l[1], tail[2] + l[2]]
  }
  return { per: per * 2, buckets: merged, tail: nextTail }
}

/** A new curve with these results (from MENACE's side, oldest first) added. Never mutates its input. */
export function addResults(curve: Curve, results: readonly Result[]): Curve {
  if (results.length === 0) return curve
  let per = curve.per
  let buckets = curve.buckets.slice()
  let tail: Counts = [...curve.tail]
  for (const r of results) {
    tail[r === 'X' ? 0 : r === 'D' ? 1 : 2]++
    if (sum(tail) >= per) {
      buckets.push(tail)
      tail = [0, 0, 0]
      if (buckets.length > MAX_BUCKETS) ({ per, buckets, tail } = coarsen(per, buckets, tail))
    }
  }
  return { per, buckets, tail, runs: curve.runs }
}

const withRun = (curve: Curve, opponent: RunOpponent): Curve => ({
  ...curve,
  runs: [...curve.runs, { start: curveTotal(curve), opponent }].slice(-MAX_RUNS),
})

/** Marks where a training run against `opponent` begins, at the current game count. */
export function startRun(curve: Curve, opponent: Exclude<RunOpponent, 'player' | 'tinker' | 'learned'>): Curve {
  return withRun(curve, opponent)
}

/**
 * Marks where the player's games resume after a training run. Nothing to mark when no run has been
 * recorded (the player's games are the default) or when the latest mark is already the player's.
 */
export function markPlayer(curve: Curve): Curve {
  const last = curve.runs[curve.runs.length - 1]
  if (last === undefined || last.opponent === 'player' || last.opponent === 'tinker' || last.opponent === 'learned') return curve
  return withRun(curve, 'player')
}

/**
 * Marks where the rewards changed (Tinker), so results before and after are not silently mixed.
 * Nothing to mark on an empty curve, or when the latest mark is already this spot's.
 */
export function markTinker(curve: Curve): Curve {
  const total = curveTotal(curve)
  const last = curve.runs[curve.runs.length - 1]
  if (total === 0 || (last !== undefined && last.opponent === 'tinker' && last.start === total)) return curve
  return withRun(curve, 'tinker')
}

/** Marks the game where MENACE first went ten without a loss against the player (letter L). Once per spot. */
export function markLearned(curve: Curve): Curve {
  const total = curveTotal(curve)
  const last = curve.runs[curve.runs.length - 1]
  if (last !== undefined && last.opponent === 'learned' && last.start === total) return curve
  return withRun(curve, 'learned')
}

export interface Bin {
  /** First and last game number in the bin, counting from 1. */
  start: number
  end: number
  games: number
  won: number
  drawn: number
  lost: number
}

export interface BinShares {
  start: number
  end: number
  games: number
  win: number
  draw: number
  loss: number
}

export interface CurveView {
  /** Games a bin spans, the same for every bin but the oldest (which can hold fewer) and the newest (which also holds the unfinished tail). */
  size: number
  bins: Bin[]
  /** The newest bin as shares: what the end labels, the right edge of the plot and the summary all show. */
  last: BinShares | null
  /** The text version of the chart. */
  summary: string
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const num = (n: number) => n.toLocaleString('en-US')

/**
 * Bins covering every game from the bucket that holds game `from` + 1 (default: the first game).
 * Bins are whole buckets, counted back from the newest, so each is exact; the newest bin takes the
 * unfinished tail, so no game is left out of the plot or the numbers beside it.
 */
function makeBins(curve: Curve, from: number): { size: number; bins: Bin[] } {
  const { per, buckets, tail } = curve
  const first = Math.min(buckets.length, Math.max(0, Math.floor(from / per)))
  const m = buckets.length - first
  // Wide enough bins to smooth noise, but never so wide that a short view has fewer than about ten.
  const minK = Math.min(Math.ceil(MIN_BIN_GAMES / per), Math.max(1, Math.floor(m / 10)))
  const k = Math.max(1, Math.ceil(m / MAX_BINS), minK)
  const tailGames = sum(tail)
  const bins: Bin[] = []
  if (m === 0) {
    if (tailGames > 0) {
      bins.push({ start: buckets.length * per + 1, end: buckets.length * per + tailGames, games: tailGames, won: tail[0], drawn: tail[1], lost: tail[2] })
    }
    return { size: k * per, bins }
  }
  for (let e = buckets.length; e > first; e -= k) {
    const s = Math.max(first, e - k)
    let won = 0
    let drawn = 0
    let lost = 0
    for (let i = s; i < e; i++) {
      won += buckets[i][0]
      drawn += buckets[i][1]
      lost += buckets[i][2]
    }
    let end = e * per
    if (e === buckets.length) {
      won += tail[0]
      drawn += tail[1]
      lost += tail[2]
      end += tailGames
    }
    const start = s * per + 1
    bins.push({ start, end, games: end - start + 1, won, drawn, lost })
  }
  bins.reverse()
  return { size: k * per, bins }
}

/** The latest run as text, or '' when no run is recorded. */
function latestRun(curve: Curve): string {
  const r = curve.runs[curve.runs.length - 1]
  if (r === undefined) return ''
  const n = num(curveTotal(curve) - r.start)
  if (r.opponent === 'learned') return ` Latest run: ${n} since it learned you.`
  return r.opponent === 'tinker' ? ` Latest run: ${n} since the rewards changed.` : ` Latest run: ${n} against ${RUN_NAMES[r.opponent]}.`
}

/** Everything the chart, its labels and the summary show. `from` starts the view at that game (for a latest-run view). */
export function curveView(curve: Curve, opts: { from?: number } = {}): CurveView {
  const { size, bins } = makeBins(curve, opts.from ?? 0)
  const b = bins[bins.length - 1]
  if (b === undefined) return { size, bins, last: null, summary: 'No games on the curve yet.' }
  const last: BinShares = { start: b.start, end: b.end, games: b.games, win: b.won / b.games, draw: b.drawn / b.games, loss: b.lost / b.games }
  const span = b.games === 1 ? `game ${num(b.start)}` : `games ${num(b.start)} to ${num(b.end)}`
  return {
    size,
    bins,
    last,
    summary: `Over ${span} MENACE won ${pct(last.win)}, drew ${pct(last.draw)}, lost ${pct(last.loss)}.${latestRun(curve)}`,
  }
}

export interface StackPoint {
  /** Game number. */
  x: number
  win: number
  draw: number
  loss: number
}

/**
 * The plotted points: one at the middle of each bin, plus one at each edge repeating the nearest
 * bin, so the right edge of the plot holds exactly the newest bin's numbers.
 */
export function curvePoints(bins: readonly Bin[]): StackPoint[] {
  if (bins.length === 0) return []
  const share = (b: Bin) => ({ win: b.won / b.games, draw: b.drawn / b.games, loss: b.lost / b.games })
  const first = bins[0]
  const last = bins[bins.length - 1]
  return [
    { x: first.start - 1, ...share(first) },
    ...bins.map((b) => ({ x: (b.start - 1 + b.end) / 2, ...share(b) })),
    { x: last.end, ...share(last) },
  ]
}

function isCounts(v: unknown): v is Counts {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)
}

/** per must be BUCKET_GAMES times a power of two, within MAX_PER. Exact maths: no 32-bit bit tricks. */
function isBucketSize(per: unknown): per is number {
  if (typeof per !== 'number' || !Number.isSafeInteger(per) || per < BUCKET_GAMES || per > MAX_PER) return false
  return per % BUCKET_GAMES === 0 && Number.isInteger(Math.log2(per / BUCKET_GAMES))
}

function parseRuns(v: unknown, total: number): Run[] | null {
  if (v === undefined) return []
  if (!Array.isArray(v) || v.length > MAX_RUNS) return null
  const out: Run[] = []
  let prev = 0
  for (const r of v) {
    if (typeof r !== 'object' || r === null) return null
    const { start, opponent } = r as Record<string, unknown>
    if (typeof start !== 'number' || !Number.isSafeInteger(start) || start < prev || start > total) return null
    if (!RUN_OPPONENTS.includes(opponent as RunOpponent)) return null
    out.push({ start, opponent: opponent as RunOpponent })
    prev = start
  }
  return out
}

/**
 * Reads a stored curve. `undefined` (an older save) is an empty curve. Anything else that fails
 * a check gives null, so the caller can drop the curve without losing the brain.
 */
export function parseCurve(v: unknown): Curve | null {
  if (v === undefined) return emptyCurve()
  if (typeof v !== 'object' || v === null) return null
  const { per, buckets, tail, runs } = v as Record<string, unknown>
  if (!isBucketSize(per)) return null
  if (!Array.isArray(buckets) || buckets.length > MAX_BUCKETS) return null
  if (!buckets.every((b) => isCounts(b) && sum(b) === per)) return null
  if (!isCounts(tail) || sum(tail) >= per) return null
  const parsedRuns = parseRuns(runs, buckets.length * per + sum(tail))
  if (parsedRuns === null) return null
  return { per, buckets: buckets.map((b) => [...(b as Counts)] as Counts), tail: [...tail], runs: parsedRuns }
}

/** The game count where the latest run began, or null when no run is recorded. */
export function latestRunStart(curve: Curve): number | null {
  const r = curve.runs[curve.runs.length - 1]
  return r === undefined ? null : r.start
}

/** Share of all games (0 to 1) that the latest run covers. 1 when no run is recorded. */
export function latestRunShare(curve: Curve): number {
  const start = latestRunStart(curve)
  const total = curveTotal(curve)
  return start === null || total === 0 ? 1 : (total - start) / total
}
